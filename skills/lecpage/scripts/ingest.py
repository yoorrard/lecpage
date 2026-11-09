#!/usr/bin/env python3
"""lecpage 교재 해석 — 파이썬 보조 스크립트.

JS 엔진(engine/src/ingest)과 같은 모양의 Material JSON을 만듭니다(references/material-format.md).
주로 Node에 pdf.js(pdfjs-dist)가 없을 때 PDF를 읽는 용도이며, PPTX·DOCX·HWPX·TXT·MD도 읽습니다.

    python3 ingest.py <파일> -o material.json [--images 폴더] [--id deck1]

쓰는 라이브러리(있으면): PyMuPDF(pymupdf/fitz) · python-pptx · python-docx · markitdown
감지(detected)는 비워 둡니다(null). Node CLI(scripts/ingest.mjs)가 JS 감지 규칙으로 채웁니다.
오류는 예외 대신 errors: [{code, message_ko}] 로 돌려줍니다.
"""
import argparse
import json
import os
import re
import sys
import unicodedata
import zipfile
import xml.etree.ElementTree as ET

GENERATOR = 'lecpage-ingest-py/1'
MAX_BYTES = 100 * 1024 * 1024
MAX_UNCOMPRESSED = 600 * 1024 * 1024
MAX_PAGES = 1000
WEB_IMAGE = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'}

MESSAGES = {
    'empty': '파일이 비어 있어요. 내용이 있는 파일을 다시 올려 주세요.',
    'too-large': '파일이 너무 커요. 100MB 이하로 줄이거나, 그림을 압축하거나, PDF로 저장해 올려 주세요.',
    'legacy-hwp': '예전 한글 파일(.hwp)은 바로 읽을 수 없어요. 한글에서 [파일 → 다른 이름으로 저장하기]를 눌러 파일 형식을 "HWPX" 또는 "PDF"로 바꿔 저장한 뒤 올려 주세요.',
    'legacy-ppt': '예전 파워포인트 파일(.ppt)은 바로 읽을 수 없어요. 파워포인트에서 [다른 이름으로 저장]을 눌러 "PowerPoint 프레젠테이션(.pptx)" 또는 "PDF"로 저장한 뒤 올려 주세요.',
    'legacy-doc': '예전 워드 파일(.doc)은 바로 읽을 수 없어요. 워드에서 [다른 이름으로 저장]을 눌러 "Word 문서(.docx)" 또는 "PDF"로 저장한 뒤 올려 주세요.',
    'legacy-office': '예전 형식의 오피스 파일이라 바로 읽을 수 없어요. PPTX·DOCX·PDF 가운데 하나로 다시 저장해 올려 주세요.',
    'encrypted': '암호가 걸린 파일이에요. 원본 프로그램에서 암호를 해제하고 다시 저장한 뒤 올려 주세요.',
    'drm': '문서 보안(DRM)이 걸린 파일 같아요. 학교 문서보안 프로그램에서 보안을 해제하거나, PDF로 인쇄(저장)한 뒤 올려 주세요.',
    'corrupt': '파일을 열 수 없어요. 파일이 손상되었거나 다른 형식일 수 있어요. 원본 프로그램에서 다시 저장해 올려 주세요.',
    'zip-bomb': '압축을 풀면 지나치게 커지는 파일이라 안전을 위해 읽지 않았어요. 그림을 줄이거나 PDF로 저장해 올려 주세요.',
    'unsupported': '이 형식은 아직 읽을 수 없어요. PPTX·PDF·HWPX·DOCX·TXT 가운데 하나로 저장해 올려 주세요.',
    'pdf-encrypted': '암호가 걸린 PDF예요. 암호를 해제한 PDF로 다시 저장해 올려 주세요.',
    'pdf-failed': 'PDF를 읽다가 문제가 생겼어요. 다른 프로그램에서 PDF로 다시 저장하거나 원본(PPTX·HWPX)을 올려 주세요.',
    'no-text': '글자를 읽을 수 없는 PDF예요(스캔본이나 그림으로 된 PDF). 쪽 그림은 쓸 수 있지만, 내용은 직접 적어 주시거나 원본 파일을 올려 주세요.',
    'needs-library': '이 형식을 읽는 파이썬 라이브러리가 없어요. pip install pymupdf python-pptx python-docx 로 설치해 주세요.',
    'parse-failed': '파일 내용을 읽다가 문제가 생겼어요. 원본 프로그램에서 다시 저장해 올려 주세요. 계속 안 되면 PDF로 올려 주세요.',
    'not-found': '파일을 찾을 수 없어요.',
}


def err(code, file=None, detail=None):
    e = {'code': code, 'message_ko': MESSAGES.get(code, MESSAGES['parse-failed'])}
    if file:
        e['file'] = file
    if detail:
        e['detail'] = str(detail)[:300]
    return e


# ── 글자 정리(JS util.normText와 같은 규칙) ──────────────────────
_ZW = re.compile('[​-‍⁠﻿­]')
_CTRL = re.compile('[\u0000-\u0008\u000e-\u001f\u007f]')
_SP = re.compile('[\t   -   　]')
_PUA = re.compile('[-]')


def norm_text(s):
    if not s:
        return ''
    t = unicodedata.normalize('NFC', str(s))
    t = re.sub(r'\r\n?', '\n', t)
    t = re.sub('[\u000b\u000c  ]', '\n', t)
    t = _ZW.sub('', t)
    t = _CTRL.sub('', t)
    t = _PUA.sub('', t)
    t = _SP.sub(' ', t)
    t = re.sub(r' {2,}', ' ', t)
    t = re.sub(r' *\n *', '\n', t)
    t = re.sub(r'\n{3,}', '\n\n', t)
    return t.strip()


def norm_line(s):
    return re.sub(r'\s*\n+\s*', ' ', norm_text(s)).strip()


def text_key(s):
    return re.sub(r'[\s"\'“”‘’「」『』`.,!?~·:;()\[\]{}<>\-–—…]', '', norm_line(s).lower())


def tidy(s):
    s = norm_line(s)
    s = re.sub(r'\s+([.,!?)\]}:;·%])', r'\1', s)
    return re.sub(r'([(\[{])\s+', r'\1', s)


URL_RE = re.compile(r'\b((?:https?://|www\.)[^\s<>"\'“”‘’()\[\]{}|\\^`]+[^\s<>"\'“”‘’()\[\]{}|\\^`.,;:!?。、])', re.I)


def clean_url(u):
    s = norm_line(u).replace('\\:', ':')
    if not s:
        return ''
    if re.match(r'^mailto:', s, re.I):
        return s
    if s.lower().startswith('www.'):
        s = 'https://' + s
    return s if re.match(r'^https?://[^\s]+$', s, re.I) else ''


def ext_of(name):
    m = re.search(r'\.([A-Za-z0-9]{1,8})$', name or '')
    return m.group(1).lower() if m else ''


def mime_of(name):
    e = ext_of(name)
    return {'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'gif': 'image/gif', 'bmp': 'image/bmp',
            'webp': 'image/webp', 'svg': 'image/svg+xml', 'emf': 'image/x-emf', 'wmf': 'image/x-wmf',
            'tif': 'image/tiff', 'tiff': 'image/tiff'}.get(e, 'application/octet-stream')


def empty_material():
    return {'version': 1, 'kind': 'lecpage-material', 'generator': GENERATOR, 'files': [], 'pages': [], 'design': {},
            'meta': {}, 'boilerplate': [], 'detected': None, 'errors': [], 'warnings': []}


def new_page(fid, no, kind, title=''):
    return {'file': fid, 'page': no, 'kind': kind, 'title': norm_line(title), 'paragraphs': [], 'notes': '',
            'links': [], 'images': [], 'tables': []}


class ImageSink:
    """그림을 --images 폴더에 <id>.<ext>로 저장하고 src(출력 JSON 기준 상대 경로)를 돌려줌"""

    def __init__(self, folder, out_path):
        self.folder = folder
        self.base = os.path.dirname(os.path.abspath(out_path)) if out_path else os.getcwd()
        if folder:
            os.makedirs(folder, exist_ok=True)

    def save(self, im, data):
        if not self.folder or not data:
            return
        ext = (ext_of(im.get('name', '')) or 'png').replace('jpeg', 'jpg')
        path = os.path.join(self.folder, f"{im['id']}.{ext}")
        with open(path, 'wb') as f:
            f.write(data)
        im['src'] = os.path.relpath(path, self.base).replace(os.sep, '/')
        im['size'] = len(data)


# ── ZIP 안전 검사 ──────────────────────────────────────
def open_zip(path):
    z = zipfile.ZipFile(path)
    infos = z.infolist()
    if len(infos) > 20000 or sum(i.file_size for i in infos) > MAX_UNCOMPRESSED:
        raise ValueError('zip-bomb')
    return z


def zread(z, name):
    try:
        info = z.getinfo(name)
    except KeyError:
        return None
    if info.file_size > 200 * 1024 * 1024:
        raise ValueError('zip-bomb')
    return z.read(name)


def xml_of(z, name):
    data = zread(z, name)
    if data is None:
        return None
    try:
        return ET.fromstring(data)
    except ET.ParseError:
        return None


def local(tag):
    return tag.rsplit('}', 1)[-1] if isinstance(tag, str) else ''


def find_local(el, name):
    for x in el.iter():
        if local(x.tag) == name:
            return x
    return None


def theme_design(z, path='ppt/theme/theme1.xml'):
    root = xml_of(z, path)
    out = {'colors': {}, 'fonts': {'major': {'latin': '', 'ea': ''}, 'minor': {'latin': '', 'ea': ''}}}
    if root is None:
        return out
    out['theme'] = root.get('name', '')
    scheme = find_local(root, 'clrScheme')
    if scheme is not None:
        for c in scheme:
            key = local(c.tag)
            for v in c:
                val = v.get('val') if local(v.tag) == 'srgbClr' else v.get('lastClr')
                if val and re.match(r'^[0-9a-fA-F]{6}$', val):
                    out['colors'][key] = '#' + val.upper()
    fs = find_local(root, 'fontScheme')
    if fs is not None:
        for key, tag in (('major', 'majorFont'), ('minor', 'minorFont')):
            f = next((x for x in fs if local(x.tag) == tag), None)
            if f is None:
                continue
            latin = next((x.get('typeface', '') for x in f if local(x.tag) == 'latin'), '')
            ea = next((x.get('typeface', '') for x in f if local(x.tag) == 'ea'), '')
            if not ea:
                ea = next((x.get('typeface', '') for x in f if local(x.tag) == 'font' and x.get('script') == 'Hang'), '')
            out['fonts'][key] = {'latin': latin, 'ea': ea}
    return out


def ratio_name(w, h):
    r = w / h if h else 0
    for name, v in (('16:9', 16 / 9), ('4:3', 4 / 3), ('16:10', 1.6), ('A4', 297 / 210), ('A4-세로', 210 / 297), ('1:1', 1)):
        if v and abs(r - v) / v < 0.02:
            return name
    return f'{round(r, 2)}:1'


# ── PPTX ─────────────────────────────────────────────
def parse_pptx(path, fid, sink, warnings):
    from pptx import Presentation
    from pptx.enum.shapes import MSO_SHAPE_TYPE, PP_PLACEHOLDER
    prs = Presentation(path)
    cx, cy = prs.slide_width or 12192000, prs.slide_height or 6858000
    pages, fonts = [], {}
    title_types = {PP_PLACEHOLDER.TITLE, PP_PLACEHOLDER.CENTER_TITLE}
    skip_types = {PP_PLACEHOLDER.DATE, PP_PLACEHOLDER.FOOTER, PP_PLACEHOLDER.SLIDE_NUMBER, PP_PLACEHOLDER.HEADER}
    layout_hint = {'Title Slide': 'title', 'Section Header': 'section', 'Title Only': 'title-only', 'Blank': 'blank',
                   'Two Content': 'two-content', 'Comparison': 'comparison', 'Picture with Caption': 'picture',
                   'Title and Content': 'content', 'Content with Caption': 'content-caption'}
    media_use = {}

    def walk(shapes, out):
        for sh in shapes:
            if sh.shape_type == MSO_SHAPE_TYPE.GROUP:
                walk(sh.shapes, out)
            else:
                out.append(sh)

    for no, slide in enumerate(list(prs.slides)[:MAX_PAGES], 1):
        page = new_page(fid, no, 'slide')
        shapes = []
        walk(slide.shapes, shapes)
        shapes.sort(key=lambda s: ((s.top or 0) // max(1, int(cy * 0.03)), s.left or 0))
        title = ''
        block = 0
        img_seq = 0
        for sh in shapes:
            ph = None
            if sh.is_placeholder:
                try:
                    ph = sh.placeholder_format.type
                except Exception:
                    ph = None
                if ph in skip_types:
                    continue
            if sh.has_text_frame and ph in title_types and not title:
                title = norm_line(sh.text_frame.text)
                continue
            if getattr(sh, 'has_table', False) and sh.has_table:
                rows = []
                for r in sh.table.rows:
                    row = [norm_text(c.text) for c in r.cells]
                    if any(row):
                        rows.append(row)
                if rows:
                    page['tables'].append({'rows': rows})
                continue
            if sh.shape_type == MSO_SHAPE_TYPE.PICTURE:
                try:
                    img = sh.image
                    img_seq += 1
                    pname = img.filename or f'image.{img.ext}'
                    partname = str(sh._element.blip_rId and slide.part.related_part(sh._element.blip_rId).partname).lstrip('/')
                    im = {'id': f'{fid}-p{no}-{img_seq}', 'name': os.path.basename(partname) or pname, 'path': partname,
                          'mime': img.content_type, 'width': round((sh.width or 0) / 9525), 'height': round((sh.height or 0) / 9525),
                          'share': round(((sh.width or 0) * (sh.height or 0)) / (cx * cy), 2)}
                    alt = sh._element.nvPicPr.cNvPr.get('descr')
                    if alt:
                        im['alt'] = norm_line(alt)
                    if img.ext.lower() not in WEB_IMAGE:
                        im['web'] = False
                    media_use[partname] = media_use.get(partname, 0) + 1
                    sink.save(im, img.blob)
                    page['images'].append(im)
                except Exception:
                    pass
                continue
            if not sh.has_text_frame:
                continue
            block += 1
            role = 'subtitle' if ph == PP_PLACEHOLDER.SUBTITLE else ('body' if ph is not None else 'text')
            counters = {}
            for p in sh.text_frame.paragraphs:
                text = ''
                links = []
                for r in p.runs:
                    text += r.text
                    if r.font.name:
                        fonts[r.font.name] = fonts.get(r.font.name, 0) + len(r.text)
                    try:
                        addr = r.hyperlink.address
                    except Exception:
                        addr = None
                    if addr:
                        links.append({'url': clean_url(addr), 'label': norm_line(r.text)})
                text = norm_text(text.replace('\x0b', '\n'))
                for l in links:
                    if l['url'] and not any(x['url'] == l['url'] for x in page['links']):
                        page['links'].append(l)
                if not text:
                    continue
                pPr = p._p.pPr
                lvl = p.level or 0
                para = {'text': text, 'level': lvl, 'block': block, 'role': role}
                if pPr is not None and any(local(c.tag) == 'buAutoNum' for c in pPr):
                    counters[lvl] = counters.get(lvl, 0) + 1
                    para['num'] = counters[lvl]
                elif pPr is not None and any(local(c.tag) == 'buChar' for c in pPr):
                    para['bullet'] = True
                elif role == 'body' and not (pPr is not None and any(local(c.tag) == 'buNone' for c in pPr)):
                    para['bullet'] = True
                page['paragraphs'].append(para)
        if not title:
            cand = next((p for p in page['paragraphs'] if len(p['text']) <= 80 and p['role'] != 'subtitle'), None)
            if cand and len(page['paragraphs']) <= 3:
                title = cand['text']
                page['paragraphs'].remove(cand)
                page['titleGuessed'] = True
        page['title'] = norm_line(title)
        try:
            if slide.has_notes_slide:
                page['notes'] = norm_text(slide.notes_slide.notes_text_frame.text)
        except Exception:
            pass
        try:
            page['layout'] = layout_hint.get(slide.slide_layout.name, 'content')
            page['layoutName'] = slide.slide_layout.name
        except Exception:
            page['layout'] = 'content'
        if slide._element.get('show') == '0':
            page['hidden'] = True
        pages.append(page)
    repeat_min = max(3, -(-len(pages) * 4 // 10))
    for p in pages:
        for im in p['images']:
            if media_use.get(im['path'], 0) >= repeat_min:
                im['repeated'] = True
    with zipfile.ZipFile(path) as z:
        design = theme_design(z)
    design['fontsUsed'] = [{'name': k, 'count': v} for k, v in sorted(fonts.items(), key=lambda x: -x[1])[:6]]
    w, h = round(cx / 9525), round(cy / 9525)
    design['slideSize'] = {'width': w, 'height': h, 'ratio': ratio_name(w, h)}
    cp = prs.core_properties
    meta = {k: v for k, v in {'title': norm_line(cp.title or ''), 'author': norm_line(cp.author or ''),
                              'modified': cp.modified.isoformat() if cp.modified else ''}.items() if v}
    return pages, design, meta, 'slide'


# ── PDF ──────────────────────────────────────────────
def parse_pdf(path, fid, sink, warnings):
    try:
        import pymupdf as fitz
    except ImportError:
        import fitz
    try:
        doc = fitz.open(path)
    except Exception as e:
        raise ValueError('pdf-failed') from e
    if doc.needs_pass:
        raise ValueError('pdf-encrypted')
    pages = []
    chars = 0
    size = None
    xref_use, saved = {}, {}
    for i, pg in enumerate(doc):
        if i >= MAX_PAGES:
            break
        no = i + 1
        rect = pg.rect
        if size is None:
            size = (round(rect.width), round(rect.height))
        d = pg.get_text('dict')
        raw = []
        for b in d.get('blocks', []):
            if b.get('type') != 0:
                continue
            for ln in b.get('lines', []):
                spans = [s for s in ln.get('spans', []) if s.get('text', '').strip()]
                if not spans:
                    continue
                x0, y0, x1, y1 = ln['bbox']
                raw.append({'spans': spans, 'x': x0, 'y': y0, 'right': x1, 'size': max(s['size'] for s in spans),
                            'text': ''.join(s['text'] for s in ln['spans'])})
        # 같은 높이의 조각을 한 줄로(번호 "1."이 따로 떨어진 경우 등)
        raw.sort(key=lambda l: (l['y'], l['x']))
        merged = []
        for l in raw:
            last = merged[-1] if merged else None
            if last and abs(last['y'] - l['y']) <= min(last['size'], l['size']) * 0.5:
                last['parts'].append(l)
            else:
                merged.append({'y': l['y'], 'size': l['size'], 'parts': [l]})
        lines = []
        for g in merged:
            parts = sorted(g['parts'], key=lambda l: l['x'])
            text = tidy(' '.join(pp['text'] for pp in parts))
            if not text or re.match(r'^-?\s*\d{1,3}\s*-?$', text):
                continue
            spans = [s for pp in parts for s in pp['spans']]
            bold = all((s.get('flags', 0) & 16) or re.search(r'bold|black|heavy', s.get('font', ''), re.I) for s in spans)
            lines.append({'text': text, 'x': parts[0]['x'], 'y': g['y'], 'right': max(pp['right'] for pp in parts),
                          'size': max(pp['size'] for pp in parts), 'bold': bool(bold)})
        # 제목
        title, guessed, tlines = '', False, []
        if lines:
            sizes = sorted(l['size'] for l in lines)
            median, mx = sizes[len(sizes) // 2], sizes[-1]
            big = [l for l in lines if l['size'] >= mx * 0.92]
            others = [l for l in lines if l['size'] < mx * 0.92]
            other_max = max((l['size'] for l in others), default=0)
            chars_big = sum(len(l['text']) for l in big)
            clearly = not others or mx >= other_max * 1.3
            top = big[0]['y'] <= rect.height * 0.45
            if len(big) <= 3 and chars_big <= 120 and (clearly or (top and mx >= median * 1.2)):
                tlines.append(big[0])
                for l in big[1:]:
                    if l['y'] - tlines[-1]['y'] <= tlines[-1]['size'] * 1.8:
                        tlines.append(l)
                    else:
                        break
            elif len(lines[0]['text']) <= 50 and (lines[0]['bold'] or lines[0]['size'] > median) and lines[0]['y'] <= rect.height * 0.3:
                tlines.append(lines[0])
                guessed = True
            title = norm_line(' '.join(l['text'] for l in tlines))
        body = [l for l in lines if l not in tlines]
        page = new_page(fid, no, 'page', title)
        if guessed and title:
            page['titleGuessed'] = True
        min_x = min((l['x'] for l in body), default=0)
        max_w = max((l['right'] - l['x'] for l in body), default=0)
        prev = None
        block = 1
        for l in body:
            text = l['text']
            bullet = False
            m = re.match(r'^[•·▪▫◦●○■□◆◇▶▷►➢➤✓✔☞※\-–]\s*', text)
            if m:
                bullet, text = True, text[m.end():]
            if not text:
                continue
            level = max(0, min(4, round((l['x'] - min_x) / max(8, l['size'] * 1.6))))
            vgap = l['y'] - prev['line']['y'] if prev else 0
            if prev and vgap > prev['line']['size'] * 2.2:
                block += 1
            marker = prev and re.match(r'^(\d{1,2}[.)]|[①-⑳]|[-•·▪]|STEP\s*\d)', prev['para']['text'], re.I)
            cont = (prev and not bullet and not re.match(r'^(\d{1,2}[.)]|[①-⑳]|STEP)', text, re.I)
                    and not re.match(r'^[^\s:：]{1,6}\s*[:：]', text)
                    and abs(l['size'] - prev['line']['size']) <= prev['line']['size'] * 0.12
                    and 0 < vgap < prev['line']['size'] * 1.7
                    and len(prev['line']['text']) >= 18
                    and (prev['line']['right'] - prev['line']['x']) >= max_w * 0.75
                    and not re.search(r'[.!?。:]$|[다요]\.?$', prev['para']['text'])
                    and abs(l['x'] - prev['x']) <= l['size'] * (2.5 if marker else 1.2))
            if cont:
                prev['para']['text'] = norm_line(prev['para']['text'] + ' ' + text)
                prev['line'] = l
                continue
            para = {'text': text, 'level': level, 'block': block, 'size': round(l['size'])}
            if bullet:
                para['bullet'] = True
            page['paragraphs'].append(para)
            prev = {'para': para, 'line': l, 'x': l['x']}
        chars += len(title) + sum(len(p['text']) for p in page['paragraphs'])
        for lk in pg.get_links():
            url = clean_url(lk.get('uri') or '')
            if not url or any(x['url'] == url for x in page['links']):
                continue
            label = ''
            try:
                label = tidy(pg.get_textbox(lk['from']))
            except Exception:
                pass
            page['links'].append({'url': url, 'label': label[:60]})
        if sink.folder:
            try:
                shown = [i['xref'] for i in pg.get_image_info(xrefs=True) if i.get('xref')]  # 실제로 그려진 그림만
            except Exception:
                shown = [i[0] for i in pg.get_images(full=True)]
            for k, xref in enumerate(list(dict.fromkeys(shown))[:12], 1):
                info = (xref,)
                xref_use[info[0]] = xref_use.get(info[0], 0) + 1
                try:
                    if info[0] in saved:
                        im = dict(saved[info[0]], id=f'{fid}-p{no}-{k}')
                        page['images'].append(im)
                        continue
                    x = doc.extract_image(info[0])
                    if not x or x.get('width', 0) < 48 or x.get('height', 0) < 48:
                        continue
                    im = {'id': f'{fid}-p{no}-{k}', 'name': f'image{info[0]}.{x["ext"]}', 'path': f'xref:{info[0]}',
                          'mime': mime_of('a.' + x['ext']), 'width': x.get('width', 0), 'height': x.get('height', 0)}
                    sink.save(im, x['image'])
                    saved[info[0]] = im
                    page['images'].append(im)
                except Exception:
                    pass
        pages.append(page)
    repeat_min = max(3, -(-len(pages) * 4 // 10))
    for p in pages:
        for im in p['images']:
            x = int(im['path'].split(':')[1]) if im['path'].startswith('xref:') else 0
            if xref_use.get(x, 0) >= repeat_min:
                im['repeated'] = True
    if chars < max(20, len(pages) * 8):
        warnings.append(err('no-text'))
    md = doc.metadata or {}
    meta = {k: v for k, v in {'title': norm_line(md.get('title', '')), 'author': norm_line(md.get('author', '')),
                              'creator': norm_line(md.get('creator', ''))}.items() if v}
    design = {'slideSize': {'width': size[0], 'height': size[1], 'ratio': ratio_name(*size)}} if size else {}
    return pages, design, meta, 'page'


# ── 문서형 공통(블록 → 쪽) ───────────────────────────────
def blocks_to_pages(blocks, fid, chunk=25):
    heads = [b for b in blocks if b.get('type') == 'p' and b.get('text') and b.get('heading') is not None]
    h1 = sum(1 for b in heads if b['heading'] <= 1)
    h2 = sum(1 for b in heads if b['heading'] == 2)
    mode, split = 'chunk', 1
    if h1 >= 3:
        mode, split = 'heading', 1
    elif h1 + h2 >= 3:
        mode, split = 'heading', 2
    elif sum(1 for b in blocks if b.get('pageBreakBefore')) >= 2:
        mode = 'break'
    elif heads:
        mode, split = 'heading', 2

    def is_split(b):
        if mode == 'heading':
            return b.get('type') == 'p' and b.get('heading') is not None and b['heading'] <= split
        if mode == 'break':
            return bool(b.get('pageBreakBefore'))
        return False

    pages, cur, count, block = [], None, 0, 0
    for b in blocks:
        start = cur is None or (is_split(b) and (cur['paragraphs'] or cur['tables'] or cur['images'])) \
            or (mode == 'chunk' and count >= chunk and b.get('type') == 'p' and b.get('gapBefore'))
        as_title = b.get('type') == 'p' and b.get('heading') is not None and len(b.get('text', '')) <= 120
        if start:
            cur = new_page(fid, len(pages) + 1, 'section', b['text'] if as_title else '')
            pages.append(cur)
            count = 0
            if as_title:
                cur['links'] += b.get('links', [])
                continue
        elif not cur['title'] and not cur['paragraphs'] and as_title:
            cur['title'] = norm_line(b['text'])
            continue
        if b.get('type') == 'table':
            if b.get('rows'):
                cur['tables'].append({'rows': b['rows']})
            continue
        cur['links'] += b.get('links', [])
        cur['images'] += b.get('images', [])
        if not b.get('text'):
            continue
        if b.get('gapBefore') or b.get('pageBreakBefore'):
            block += 1
        para = {'text': b['text'], 'level': b.get('level', 0), 'block': block}
        for k in ('bullet', 'num', 'role'):
            if b.get(k):
                para[k] = b[k]
        if b.get('heading') is not None:
            para['role'] = 'heading'
        cur['paragraphs'].append(para)
        count += 1
    for p in pages:
        if not p['title'] and p['paragraphs'] and len(p['paragraphs'][0]['text']) <= 60:
            p['title'] = norm_line(p['paragraphs'].pop(0)['text'])
            p['titleGuessed'] = True
        seen = {}
        for l in p['links']:
            if l['url'] and l['url'] not in seen:
                seen[l['url']] = l
        p['links'] = list(seen.values())
    pages = [p for p in pages if p['title'] or p['paragraphs'] or p['tables'] or p['images']]
    for i, p in enumerate(pages, 1):
        p['page'] = i
    return pages


# ── DOCX ─────────────────────────────────────────────
def parse_docx(path, fid, sink, warnings):
    import docx
    d = docx.Document(path)
    W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
    R = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
    rels = d.part.rels
    blocks, seq, counters = [], [0], {}

    def para_block(p_el):
        style = ''
        pPr = p_el.find(W + 'pPr')
        if pPr is not None and pPr.find(W + 'pStyle') is not None:
            sid = pPr.find(W + 'pStyle').get(W + 'val')
            try:
                style = d.styles.get_by_id(sid, 1).name or sid
            except Exception:
                style = sid or ''
        heading = None
        m = re.match(r'^(?:heading|제목)\s*(\d)$', style.strip(), re.I)
        if m:
            heading = int(m.group(1))
        elif style.lower() == 'title':
            heading = 0
        text, links, images = '', [], []
        for el in p_el.iter():
            tag = local(el.tag)
            if tag == 't' and el.text:
                text += el.text
            elif tag == 'tab':
                text += ' '
            elif tag == 'br' and el.get(W + 'type') != 'page':
                text += '\n'
            elif tag == 'hyperlink' and el.get(R + 'id') in rels:
                rel = rels[el.get(R + 'id')]
                if rel.is_external:
                    links.append({'url': clean_url(rel.target_ref), 'label': norm_line(''.join(x.text or '' for x in el.iter(W + 't')))})
            elif tag == 'blip':
                rid = el.get(R + 'embed')
                if rid in rels and not rels[rid].is_external:
                    part = rels[rid].target_part
                    seq[0] += 1
                    name = os.path.basename(str(part.partname))
                    im = {'id': f'{fid}-img{seq[0]}', 'name': name, 'path': str(part.partname).lstrip('/'), 'mime': part.content_type}
                    sink.save(im, part.blob)
                    images.append(im)
        level, bullet, num = 0, False, 0
        numPr = pPr.find(W + 'numPr') if pPr is not None else None
        if numPr is None and style.lower().startswith('list number'):
            num = counters['_ln'] = counters.get('_ln', 0) + 1
        elif numPr is None and style.lower().startswith('list bullet'):
            bullet = True
        elif numPr is not None:
            ilvl = numPr.find(W + 'ilvl')
            level = int(ilvl.get(W + 'val')) if ilvl is not None else 0
            nid = numPr.find(W + 'numId')
            key = nid.get(W + 'val') if nid is not None else '0'
            fmt = numbering_format(d, key, level)
            if fmt in ('bullet', '', None):
                bullet = True
            else:
                arr = counters.setdefault(key, {})
                arr[level] = arr.get(level, 0) + 1
                num = arr[level]
        b = {'type': 'p', 'text': norm_text(text), 'level': level, 'heading': heading, 'links': [l for l in links if l['url']], 'images': images}
        if bullet:
            b['bullet'] = True
        if num:
            b['num'] = num
        if any(local(x.tag) == 'br' and x.get(W + 'type') == 'page' for x in p_el.iter()):
            b['pageBreakAfter'] = True
        return b

    pending_break = False
    for el in d.element.body.iterchildren():
        tag = local(el.tag)
        if tag == 'p':
            b = para_block(el)
            if pending_break and b['text']:
                b['pageBreakBefore'] = True
                pending_break = False
            if b.pop('pageBreakAfter', False):
                pending_break = True
            if b['text'] or b['images'] or b['links']:
                blocks.append(b)
        elif tag == 'tbl':
            rows = []
            for tr in el.iter(W + 'tr'):
                row = [norm_text('\n'.join(''.join(t.text or '' for t in p.iter(W + 't')) for p in tc.iter(W + 'p'))) for tc in tr.iter(W + 'tc')]
                if any(row):
                    rows.append(row)
            blocks.append({'type': 'table', 'rows': rows})
    pages = blocks_to_pages(blocks, fid)
    design = {}
    with zipfile.ZipFile(path) as z:
        design = theme_design(z, 'word/theme/theme1.xml')
    cp = d.core_properties
    meta = {k: v for k, v in {'title': norm_line(cp.title or ''), 'author': norm_line(cp.author or '')}.items() if v}
    return pages, design, meta, 'section'


_NUMFMT = {}


def numbering_format(d, num_id, level):
    try:
        part = d.part.numbering_part
    except Exception:
        return 'bullet'
    W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
    key = (id(part), num_id, level)
    if key in _NUMFMT:
        return _NUMFMT[key]
    root = part.element
    abs_id = None
    for n in root.iter(W + 'num'):
        if n.get(W + 'numId') == num_id:
            a = n.find(W + 'abstractNumId')
            abs_id = a.get(W + 'val') if a is not None else None
    fmt = 'bullet'
    for a in root.iter(W + 'abstractNum'):
        if a.get(W + 'abstractNumId') == abs_id:
            for lv in a.iter(W + 'lvl'):
                if lv.get(W + 'ilvl') == str(level):
                    f = lv.find(W + 'numFmt')
                    fmt = f.get(W + 'val') if f is not None else 'bullet'
    _NUMFMT[key] = fmt
    return fmt


# ── HWPX ─────────────────────────────────────────────
def parse_hwpx(path, fid, sink, warnings):
    z = open_zip(path)
    hpf = xml_of(z, 'Contents/content.hpf')
    manifest, sections, meta = {}, [], {}
    if hpf is not None:
        for it in hpf.iter():
            if local(it.tag) == 'item':
                manifest[it.get('id')] = (it.get('href', ''), it.get('media-type', ''))
        for ref in hpf.iter():
            if local(ref.tag) == 'itemref':
                href = manifest.get(ref.get('idref'), ('', ''))[0]
                if re.search(r'section\d*\.xml$', href, re.I):
                    sections.append(href)
        t = find_local(hpf, 'title')
        if t is not None and t.text:
            meta['title'] = norm_line(t.text)
        for m in hpf.iter():
            if local(m.tag) == 'meta' and m.get('name') == 'creator' and m.text:
                meta['author'] = norm_line(m.text)
    if not sections:
        sections = sorted([n for n in z.namelist() if re.match(r'^Contents/section\d+\.xml$', n, re.I)],
                          key=lambda n: int(re.search(r'(\d+)\.xml$', n).group(1)))
    header = xml_of(z, 'Contents/header.xml')
    styles, para_heading, font = {}, {}, ''
    if header is not None:
        for s in header.iter():
            if local(s.tag) == 'style':
                styles[s.get('id')] = (s.get('name', ''), s.get('engName', ''), s.get('paraPrIDRef'))
            elif local(s.tag) == 'paraPr':
                h = next((x for x in s if local(x.tag) == 'heading'), None)
                para_heading[s.get('id')] = (h.get('type', 'NONE').upper(), int(h.get('level', '0'))) if h is not None else ('NONE', 0)
            elif local(s.tag) == 'fontface' and s.get('lang') == 'HANGUL' and not font:
                f = next((x for x in s if local(x.tag) == 'font'), None)
                font = f.get('face', '') if f is not None else ''
    blocks, seq = [], [0]

    def run_text(t):
        out = t.text or ''
        for c in t:
            n = local(c.tag)
            out += '\n' if n == 'lineBreak' else ' ' if n in ('tab', 'nbSpace', 'fwSpace') else ''.join(c.itertext())
            out += c.tail or ''
        return out

    def read_para(p, out):
        text, links, images, field = '', [], [], None
        tables, extra = [], []
        for run in p:
            if local(run.tag) != 'run':
                continue
            for n in run:
                tag = local(n.tag)
                if tag == 't':
                    t = run_text(n)
                    text += t
                    if field is not None:
                        field['label'] += t
                elif tag == 'ctrl':
                    for x in n:
                        if local(x.tag) == 'fieldBegin' and (x.get('type') or '').upper() == 'HYPERLINK':
                            url = ''
                            for sp in x.iter():
                                if local(sp.tag) == 'stringParam':
                                    if sp.get('name') == 'Path' and sp.text:
                                        url = sp.text
                                    elif sp.get('name') == 'Command' and sp.text and not url:
                                        url = sp.text.split(';')[0]
                            field = {'url': clean_url(url.replace('\\:', ':')), 'label': ''}
                        elif local(x.tag) == 'fieldEnd' and field is not None:
                            if field['url']:
                                links.append({'url': field['url'], 'label': norm_line(field['label'])})
                            field = None
                elif tag == 'tbl':
                    rows = []
                    for tr in n:
                        if local(tr.tag) != 'tr':
                            continue
                        row = []
                        for tc in tr:
                            if local(tc.tag) != 'tc':
                                continue
                            inner = []
                            sub = next((x for x in tc if local(x.tag) == 'subList'), tc)
                            for pp in sub:
                                if local(pp.tag) == 'p':
                                    read_para(pp, inner)
                            row.append(norm_text('\n'.join(b.get('text', '') for b in inner if b.get('type') == 'p')))
                        if any(row):
                            rows.append(row)
                    if rows:
                        tables.append(rows)
                elif tag == 'pic':
                    img = find_local(n, 'img')
                    ref = img.get('binaryItemIDRef') if img is not None else None
                    href = manifest.get(ref, ('', ''))[0] if ref else ''
                    if href and href in z.namelist():
                        seq[0] += 1
                        im = {'id': f'{fid}-img{seq[0]}', 'name': os.path.basename(href), 'path': href, 'mime': mime_of(href)}
                        c = find_local(n, 'shapeComment')
                        if c is not None and c.text:
                            im['alt'] = norm_line(c.text)
                        sink.save(im, zread(z, href))
                        images.append(im)
                elif tag in ('rect', 'ellipse', 'polygon', 'container'):
                    for dt in n.iter():
                        if local(dt.tag) == 'drawText':
                            sub = next((x for x in dt if local(x.tag) == 'subList'), dt)
                            for pp in sub:
                                if local(pp.tag) == 'p':
                                    read_para(pp, extra)
        st = styles.get(p.get('styleIDRef'), ('', '', None))
        heading = None
        m = re.search(r'개요\s*(\d)|Outline\s*(\d)|Heading\s*(\d)', f'{st[0]} {st[1]}', re.I)
        if m:
            heading = int(next(g for g in m.groups() if g))
        else:
            h = para_heading.get(p.get('paraPrIDRef')) or para_heading.get(st[2])
            if h and h[0] == 'OUTLINE':
                heading = h[1] + 1
        b = {'type': 'p', 'text': norm_text(text), 'level': 0, 'heading': heading, 'links': links, 'images': images}
        if p.get('pageBreak') == '1':
            b['pageBreakBefore'] = True
        if b['text'] or images or links:
            out.append(b)
        for rows in tables:
            out.append({'type': 'table', 'rows': rows})
        out.extend(extra)

    for si, sp in enumerate(sections):
        root = xml_of(z, sp)
        if root is None:
            continue
        before = len(blocks)
        for p in root:
            if local(p.tag) == 'p':
                read_para(p, blocks)
        if si > 0 and len(blocks) > before:
            blocks[before]['pageBreakBefore'] = True
    pages = blocks_to_pages(blocks, fid)
    design = {'colors': {}, 'fonts': {'major': {'latin': font, 'ea': font}, 'minor': {'latin': font, 'ea': font}}}
    return pages, design, meta, 'section'


# ── TXT·MD·기타(markitdown) ───────────────────────────────
def parse_text(text, fid):
    blocks, gap, fence = [], False, None
    for raw in text.replace('\r\n', '\n').split('\n'):
        if fence is not None:
            if re.match(r'^\s*(```|~~~)', raw):
                blocks.append({'type': 'p', 'text': norm_text('\n'.join(fence)), 'heading': None, 'role': 'code', 'gapBefore': True})
                fence = None
            else:
                fence.append(raw)
            continue
        if re.match(r'^\s*(```|~~~)', raw):
            fence = []
            continue
        line = norm_line(raw)
        if not line:
            gap = True
            continue
        links = []

        def repl(m):
            u = clean_url(m.group(2))
            if u:
                links.append({'url': u, 'label': norm_line(m.group(1))})
            return m.group(1)
        line = re.sub(r'\[([^\]]+)\]\(([^)\s]+)[^)]*\)', repl, line)
        b = {'type': 'p', 'text': line, 'level': 0, 'heading': None, 'links': links}
        m = re.match(r'^(#{1,6})\s+(.*)$', line)
        if m:
            b['heading'] = 1 if len(m.group(1)) == 1 else len(m.group(1))
            b['text'] = m.group(2)
        else:
            m = re.match(r'^[-*+•·▪◦●○■□]\s+(.*)$', line)
            if m:
                b['bullet'] = True
                b['text'] = m.group(1)
        if gap:
            b['gapBefore'] = True
            gap = False
        blocks.append(b)
    h1 = [b for b in blocks if b.get('heading') == 1]
    if len(h1) == 1 and blocks and blocks[0] is h1[0] and any(b.get('heading') == 2 for b in blocks):
        h1[0]['heading'] = 0
    return blocks_to_pages(blocks, fid)


def decode(data):
    for enc in ('utf-8-sig', 'utf-16', 'cp949'):
        try:
            return data.decode(enc)
        except Exception:
            continue
    return data.decode('utf-8', 'replace')


# ── 공통 후처리 ─────────────────────────────────────────
def post_process(m, fid):
    pages = m['pages']
    if len(pages) >= 4:
        count = {}
        for p in pages:
            seen = set()
            for para in p['paragraphs']:
                t = para['text']
                if para.get('num') or para.get('bullet') or para.get('role') in ('body', 'heading') or len(t) > 60:
                    continue
                if re.match(r'^(\d{1,2}\s*[.)]|[①-⑳]|step\s*\d|프롬프트)', t, re.I) or re.search(r'(줘|주세요|하세요|합니다)[.!]?$', t):
                    continue
                k = text_key(t)
                if k and len(k) <= 80 and k not in seen:
                    seen.add(k)
                    count[k] = count.get(k, 0) + 1
        need = max(3, -(-len(pages) // 2))
        boiler = {k for k, n in count.items() if n >= need}
        texts = {}
        for p in pages:
            keep = []
            for para in p['paragraphs']:
                k = text_key(para['text'])
                if k in boiler:
                    texts.setdefault(k, para['text'])
                else:
                    keep.append(para)
            p['paragraphs'] = keep
        m['boilerplate'] = [{'file': fid, 'text': t} for t in texts.values()]
    for p in pages:
        lines = [p['title']] + [x['text'] for x in p['paragraphs']] + [' '.join(r) for t in p['tables'] for r in t['rows']]
        for line in lines:
            for mt in URL_RE.finditer(line or ''):
                u = mt.group(1)
                u = 'https://' + u if u.lower().startswith('www.') else u
                if any(l['url'].rstrip('/') == u.rstrip('/') for l in p['links']):
                    continue
                label = norm_line(re.sub(r'[\s:：\-–—→▶>|(\[]+$', '', line[:mt.start()]))
                p['links'].append({'url': u, 'label': label if 2 <= len(label) <= 30 else '', 'from': 'text'})


def ingest(path, fid=None, images=None, out=None):
    name = unicodedata.normalize('NFC', os.path.basename(path))
    ext = ext_of(name)
    m = empty_material()
    f = {'id': fid or '', 'name': name, 'type': '', 'size': 0, 'pages': 0, 'unit': ''}
    sink = ImageSink(images, out)
    try:
        if not os.path.isfile(path):
            raise ValueError('not-found')
        f['size'] = os.path.getsize(path)
        if f['size'] == 0:
            raise ValueError('empty')
        if f['size'] > MAX_BYTES:
            raise ValueError('too-large')
        with open(path, 'rb') as fh:
            head = fh.read(1024)
        if head.startswith(b'PK'):
            z = open_zip(path)
            names = set(z.namelist())
            mt = (zread(z, 'mimetype') or b'').decode('utf-8', 'ignore').strip()
            if 'hwp+zip' in mt or 'Contents/content.hpf' in names or 'Contents/section0.xml' in names:
                kind = 'hwpx'
            elif 'ppt/presentation.xml' in names:
                kind = 'pptx'
            elif 'word/document.xml' in names:
                kind = 'docx'
            else:
                kind = 'other'
        elif b'%PDF-' in head:
            kind = 'pdf'
        elif head.startswith(b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1'):
            raise ValueError({'hwp': 'legacy-hwp', 'ppt': 'legacy-ppt', 'doc': 'legacy-doc'}.get(ext, 'encrypted' if ext in ('pptx', 'docx', 'xlsx') else 'legacy-office'))
        elif head.startswith(b'HWP Document File'):
            raise ValueError('legacy-hwp')
        elif b'\x00' not in head:
            kind = 'md' if ext in ('md', 'markdown') else 'txt'
        else:
            raise ValueError('drm' if ext in ('pptx', 'docx', 'hwpx') else 'unsupported')
        prefix = 'deck' if kind in ('pptx', 'pdf') else 'doc'
        f['id'] = f['id'] or prefix + '1'
        fid = f['id']
        if kind == 'pptx':
            try:
                pages, design, meta, unit = parse_pptx(path, fid, sink, m['warnings'])
            except ImportError:
                pages, design, meta, unit = via_markitdown(path, fid)
        elif kind == 'pdf':
            try:
                pages, design, meta, unit = parse_pdf(path, fid, sink, m['warnings'])
            except ImportError:
                pages, design, meta, unit = via_markitdown(path, fid)
        elif kind == 'docx':
            try:
                pages, design, meta, unit = parse_docx(path, fid, sink, m['warnings'])
            except ImportError:
                pages, design, meta, unit = via_markitdown(path, fid)
        elif kind == 'hwpx':
            pages, design, meta, unit = parse_hwpx(path, fid, sink, m['warnings'])
        elif kind in ('txt', 'md'):
            with open(path, 'rb') as fh:
                pages, design, meta, unit = parse_text(decode(fh.read()), fid), {}, {}, 'section'
        else:
            pages, design, meta, unit = via_markitdown(path, fid)
        f['type'] = kind if kind != 'other' else ext
        f['pages'] = len(pages)
        f['unit'] = unit
        for k in ('title', 'author', 'modified'):
            if meta.get(k):
                f[k] = meta[k]
        if design.get('slideSize'):
            f['slideSize'] = design['slideSize']
        m['files'].append(f)
        m['pages'] = pages
        m['design'] = {k: v for k, v in design.items() if v not in ('', None, [], {})}
        m['meta'] = meta
        post_process(m, fid)
    except ValueError as e:
        code = e.args[0] if e.args and isinstance(e.args[0], str) and e.args[0] in MESSAGES else 'parse-failed'
        m['files'] = [dict(f, id=f['id'] or 'src1')]
        m['errors'].append(err(code, name, None if code != 'parse-failed' else e))
        m['pages'] = []
    except zipfile.BadZipFile as e:
        m['files'] = [dict(f, id=f['id'] or 'src1')]
        m['errors'].append(err('corrupt', name, e))
    except Exception as e:  # 마지막 그물: 예외를 밖으로 던지지 않음
        m['files'] = [dict(f, id=f['id'] or 'src1')]
        m['errors'].append(err('parse-failed', name, f'{type(e).__name__}: {e}'))
        m['pages'] = []
    return m


def via_markitdown(path, fid):
    try:
        from markitdown import MarkItDown
    except ImportError as e:
        raise ValueError('needs-library') from e
    res = MarkItDown().convert(path)
    text = getattr(res, 'text_content', None) or getattr(res, 'markdown', '') or ''
    # markitdown의 PPTX 출력: "<!-- Slide number: N -->" 로 쪽 구분
    if '<!-- Slide number:' in text:
        pages = []
        for chunk in re.split(r'<!--\s*Slide number:\s*\d+\s*-->', text)[1:]:
            notes = ''
            nm = re.search(r'###\s*Notes:\s*(.*)$', chunk, re.S)
            if nm:
                notes, chunk = norm_text(nm.group(1)), chunk[:nm.start()]
            sub = parse_text(chunk, fid)
            page = new_page(fid, len(pages) + 1, 'slide')
            for sp in sub:
                if not page['title']:
                    page['title'] = sp['title']
                elif sp['title']:
                    page['paragraphs'].append({'text': sp['title'], 'level': 0, 'block': 0, 'role': 'heading'})
                page['paragraphs'] += sp['paragraphs']
                page['links'] += sp['links']
                page['tables'] += sp['tables']
            page['notes'] = notes
            pages.append(page)
        return pages, {}, {}, 'slide'
    return parse_text(text, fid), {}, {}, 'section'


def main(argv=None):
    ap = argparse.ArgumentParser(description='lecpage 교재 해석(파이썬 보조): Material JSON 만들기')
    ap.add_argument('file')
    ap.add_argument('-o', '--out', default='material.json')
    ap.add_argument('--images', default='', help='교재 속 그림을 저장할 폴더')
    ap.add_argument('--id', default='', help='파일 id(기본 deck1·doc1)')
    a = ap.parse_args(argv)
    m = ingest(a.file, a.id or None, a.images or None, a.out)
    with open(a.out, 'w', encoding='utf-8') as fh:
        json.dump(m, fh, ensure_ascii=False, indent=2)
        fh.write('\n')
    f = m['files'][0] if m['files'] else {}
    print(f"{f.get('name', a.file)}: {len(m['pages'])}{ {'slide': '장', 'page': '쪽'}.get(f.get('unit'), '부분') } → {a.out}")
    for e in m['errors']:
        print(f"오류 [{e['code']}] {e['message_ko']}", file=sys.stderr)
    return 0 if m['pages'] else 1


if __name__ == '__main__':
    sys.exit(main())
