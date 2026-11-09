#!/usr/bin/env python3
"""lecpage ingest 테스트용 교재 견본 만들기.

    python3 make_fixtures.py            # 이 폴더에 workshop.pptx, workshop.pdf, guide.docx, plan.hwpx, notes.md 생성

필요: python-pptx, python-docx, Pillow, (PDF) LibreOffice soffice
내용은 모두 지어낸 것(가상의 학교·강사)입니다.
"""
import io
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile

from PIL import Image, ImageDraw
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.oxml.ns import qn
from pptx.util import Emu, Inches, Pt
from lxml import etree

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = '맑은 고딕'


def png(w=240, h=150, color=(255, 106, 77), label=''):
    im = Image.new('RGB', (w, h), color)
    d = ImageDraw.Draw(im)
    d.rectangle([8, 8, w - 9, h - 9], outline=(255, 255, 255), width=4)
    d.line([20, h - 30, w // 2, 30, w - 20, h - 30], fill=(255, 255, 255), width=5)
    buf = io.BytesIO()
    im.save(buf, 'PNG', optimize=True)
    return buf.getvalue()


# ── PPTX ─────────────────────────────────────────────
def set_text(tf, lines, size=None, font=FONT):
    """lines: [str | (text, level)]"""
    tf.clear()
    first = True
    for item in lines:
        text, level = (item, 0) if isinstance(item, str) else item
        p = tf.paragraphs[0] if first else tf.add_paragraph()
        first = False
        p.level = level
        r = p.add_run()
        r.text = text
        if size:
            r.font.size = Pt(size)
        if font:
            r.font.name = font
            rpr = r._r.get_or_add_rPr()
            ea = rpr.find(qn('a:ea'))
            if ea is None:
                ea = etree.SubElement(rpr, qn('a:ea'))
            ea.set('typeface', font)
    return tf


def auto_number(p, start=1):
    pPr = p._p.get_or_add_pPr()
    for tag in ('a:buNone', 'a:buChar', 'a:buAutoNum'):
        for el in pPr.findall(qn(tag)):
            pPr.remove(el)
    el = etree.SubElement(pPr, qn('a:buAutoNum'))
    el.set('type', 'arabicPeriod')
    if start != 1:
        el.set('startAt', str(start))


def no_bullet(p):
    pPr = p._p.get_or_add_pPr()
    etree.SubElement(pPr, qn('a:buNone'))


def footer(slide):
    tb = slide.shapes.add_textbox(Inches(0.3), Inches(7.05), Inches(5), Inches(0.35))
    set_text(tb.text_frame, ['○○교육지원청 AI 연수'], size=10)


def textbox(slide, x, y, w, h, lines, size=18):
    tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tb.text_frame.word_wrap = True
    set_text(tb.text_frame, lines, size=size)
    return tb


def link_run(p, text, url):
    r = p.add_run()
    r.text = text
    r.hyperlink.address = url
    return r


def make_pptx(path):
    prs = Presentation()
    prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)
    L = prs.slide_layouts  # 0 제목, 1 제목+내용, 2 구역 머리글, 5 제목만, 6 빈 화면
    img = png(label='photo')

    # 1 표지
    s = prs.slides.add_slide(L[0])
    s.shapes.title.text = '생성형 AI로 여는 우리 반 수업'
    set_text(s.placeholders[1].text_frame, [
        '2026 교원 AI 디지털 역량 강화 연수',
        '일시: 2026. 11. 4.(수) 15:10~16:40',
        '장소: 한빛초등학교 본관 3층 시청각실',
        '주관: 서울특별시교육청',
    ], size=18)

    # 2 강사 소개
    s = prs.slides.add_slide(L[1])
    s.shapes.title.text = '강사 소개'
    tf = s.placeholders[1].text_frame
    set_text(tf, ['김하늘', '한빛초등학교 교사', '현) 서울 AI 교육 선도교사', '전) 디지털 교과서 자문위원', 'hanul.kim@example.com'], size=20)
    for p in tf.paragraphs:
        no_bullet(p)
    s.placeholders[1].width = Inches(7)
    s.shapes.add_picture(io.BytesIO(img), Inches(9), Inches(2), Inches(3), Inches(1.9)).name = '강사 사진'
    footer(s)

    # 3 차례
    s = prs.slides.add_slide(L[1])
    s.shapes.title.text = '오늘의 차례'
    set_text(s.placeholders[1].text_frame, [
        'PART 1. 생성형 AI 이해하기',
        'PART 2. 제미나이로 수업 자료 만들기',
        'PART 3. NotebookLM으로 자료 정리하기',
        '마무리 및 설문',
    ])
    footer(s)

    def section(no, title):
        s = prs.slides.add_slide(L[2])
        s.shapes.title.text = f'PART {no}'
        set_text(s.placeholders[1].text_frame, [title], size=24)
        footer(s)

    # 4 PART 1
    section(1, '생성형 AI 이해하기')

    # 5 개념 + 표
    s = prs.slides.add_slide(L[5])
    s.shapes.title.text = '생성형 AI란?'
    textbox(s, 0.6, 1.5, 12, 1.6, [
        '생성형 AI(Generative AI)는 학습한 데이터를 바탕으로 새로운 글·그림·소리를 만들어 내는 기술입니다.',
        '할루시네이션(Hallucination): AI가 사실이 아닌 내용을 그럴듯하게 만들어 내는 현상',
    ], size=18)
    rows = [('도구', '잘하는 일', '계정'), ('Gemini', '검색·요약', 'Google 계정'), ('ChatGPT', '글쓰기', '이메일'), ('Claude', '긴 글 분석', '이메일')]
    tbl = s.shapes.add_table(len(rows), 3, Inches(0.6), Inches(3.4), Inches(9), Inches(2)).table
    for i, r in enumerate(rows):
        for j, v in enumerate(r):
            tbl.cell(i, j).text = v
    footer(s)

    # 6 핵심 메시지
    s = prs.slides.add_slide(L[6])
    textbox(s, 1, 2.8, 11.3, 1.5, ['AI는 선생님을 대신하지 않습니다. 선생님의 시간을 돌려줍니다!'], size=36)
    footer(s)

    # 7 PART 2
    section(2, '제미나이로 수업 자료 만들기')

    # 8 실습 1 (자동 번호 단계 + 프롬프트 + 링크 + 노트 + 그림)
    s = prs.slides.add_slide(L[1])
    s.shapes.title.text = '실습 1. 제미나이로 영상 요약하기'
    body = s.placeholders[1]
    body.width = Inches(7.4)
    tf = set_text(body.text_frame, [
        'gemini.google.com에 접속해 학교 Google 계정으로 로그인합니다.',
        '유튜브 영상 주소를 복사합니다.',
        '입력창에 영상 주소를 붙여 넣고 아래 프롬프트를 입력합니다.',
        '결과를 패들렛에 공유합니다.',
    ], size=18)
    for p in tf.paragraphs:
        auto_number(p)
    tb = textbox(s, 0.6, 5.2, 7.4, 0.8, ['프롬프트: 이 영상을 한국어로 요약해줘'], size=20)
    p = tb.text_frame.add_paragraph()
    link_run(p, '제미나이 바로가기', 'https://gemini.google.com/')
    s.shapes.add_picture(io.BytesIO(png(color=(40, 90, 200))), Inches(8.4), Inches(1.8), Inches(4.4), Inches(2.75)).name = '제미나이 화면'
    s.notes_slide.notes_text_frame.text = '영상은 3분 이내로 고르도록 안내합니다.\n학교 계정 로그인이 안 되면 개인 계정을 써도 됩니다.'
    footer(s)

    # 9 실습 2 (수동 번호 + 템플릿 프롬프트 + 따옴표 프롬프트)
    s = prs.slides.add_slide(L[5])
    s.shapes.title.text = '실습 2. 수업 활동지 만들기'
    textbox(s, 0.6, 1.4, 12, 0.5, ['1) 제미나이 입력창에 아래 내용을 붙여 넣으세요.'], size=18)
    textbox(s, 0.9, 2.0, 11.5, 1.6, [
        '역할: 너는 초등학교 5학년 과학 교사야.',
        '목표: [단원명] 수업에 쓸 활동지를 만들어 줘.',
        '형식: 표로 정리하고 문항은 5개로 해 줘.',
    ], size=16)
    textbox(s, 0.6, 3.9, 12, 1.2, ['2) 결과를 구글 문서로 내보내기', '3) 동료 선생님과 링크로 공유하기'], size=18)
    textbox(s, 0.6, 5.3, 12, 0.6, ['더 쉽게 만들고 싶다면 “우리 반 학생 수준에 맞게 더 쉬운 말로 바꿔줘”라고 입력해 보세요.'], size=16)
    footer(s)

    # 10 PART 3
    section(3, 'NotebookLM으로 자료 정리하기')

    # 11 실습 3 (STEP + 링크)
    s = prs.slides.add_slide(L[1])
    s.shapes.title.text = '실습 3. NotebookLM 노트북 만들기'
    tf = set_text(s.placeholders[1].text_frame, [
        'STEP 1 notebooklm.google.com 접속',
        'STEP 2 교육과정 PDF 업로드',
        'STEP 3 질문하기: 5학년 2학기 과학 성취기준을 표로 정리해줘',
    ], size=18)
    for p in tf.paragraphs:
        no_bullet(p)
    p = tf.add_paragraph()
    no_bullet(p)
    link_run(p, 'NotebookLM 열기', 'https://notebooklm.google.com/')
    s.notes_slide.notes_text_frame.text = '업로드할 PDF는 미리 바탕화면에 내려받아 두도록 안내.'
    footer(s)

    # 12 퀴즈
    s = prs.slides.add_slide(L[1])
    s.shapes.title.text = '확인 퀴즈'
    tf = set_text(s.placeholders[1].text_frame, [
        '다음 중 생성형 AI를 쓸 때 가장 주의해야 할 점은 무엇일까요?',
        '① 빠른 속도', '② 할루시네이션', '③ 화려한 디자인', '④ 무료 사용',
    ], size=18)
    for p in tf.paragraphs:
        no_bullet(p)
    s.notes_slide.notes_text_frame.text = '정답: ②\n해설: AI는 사실이 아닌 내용을 그럴듯하게 만들 수 있어요.'
    footer(s)

    # 13 마무리
    s = prs.slides.add_slide(L[1])
    s.shapes.title.text = '마무리'
    set_text(s.placeholders[1].text_frame, ['오늘 배운 한 가지를 내일 수업에 꼭 써 보세요.', '만족도 조사: https://forms.gle/abcdEFGH123'], size=20)
    footer(s)

    prs.core_properties.title = '생성형 AI로 여는 우리 반 수업'
    prs.core_properties.author = '김하늘'
    prs.save(path)


# ── DOCX ─────────────────────────────────────────────
def make_docx(path):
    from docx import Document
    from docx.opc.constants import RELATIONSHIP_TYPE as RT
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn as dqn
    from docx.shared import Inches as DIn

    def add_link(par, text, url):
        r_id = par.part.relate_to(url, RT.HYPERLINK, is_external=True)
        h = OxmlElement('w:hyperlink')
        h.set(dqn('r:id'), r_id)
        r = OxmlElement('w:r')
        t = OxmlElement('w:t')
        t.text = text
        r.append(t)
        h.append(r)
        par._p.append(h)

    d = Document()
    d.add_heading('AI 연수 운영 안내서', level=0)
    d.add_paragraph('이 안내서는 연수 준비와 실습 순서를 정리한 자료입니다.')
    d.add_heading('1. 연수 개요', level=1)
    d.add_paragraph('일시: 2026년 11월 4일(수) 오후 3시 10분 ~ 4시 40분')
    d.add_paragraph('장소: 한빛초등학교 본관 3층 시청각실')
    d.add_heading('2. 실습 준비', level=1)
    d.add_paragraph('Google 계정 로그인', style='List Bullet')
    d.add_paragraph('크롬 또는 웨일 브라우저 준비', style='List Bullet')
    d.add_heading('3. 실습 순서', level=1)
    for t in ['패들렛 보드에 접속합니다.', '제미나이로 안내문 초안을 만듭니다.', '완성한 글을 패들렛에 올립니다.']:
        d.add_paragraph(t, style='List Number')
    p = d.add_paragraph('패들렛 주소: ')
    add_link(p, '우리 연수 보드', 'https://padlet.com/example/ai-training')
    d.add_paragraph('프롬프트: 우리 학교 운동회 안내문을 학부모용으로 써줘')
    d.add_heading('4. 도구 정리', level=1)
    t = d.add_table(rows=3, cols=2)
    for i, (a, b) in enumerate([('도구', '쓰임'), ('Gemini', '글쓰기와 요약'), ('Padlet', '결과 공유')]):
        t.cell(i, 0).text = a
        t.cell(i, 1).text = b
    d.add_picture(io.BytesIO(png(320, 180, (60, 160, 120))), width=DIn(2.5))
    d.core_properties.title = 'AI 연수 운영 안내서'
    d.save(path)


# ── HWPX (OWPML, 손으로 조립) ─────────────────────────────
HWPX_NS = ('xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" '
           'xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" '
           'xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf" '
           'xmlns:opf="http://www.idpf.org/2007/opf/"')


def hp_para(text, style=0, para=0, page_break=False, pid=[0]):
    pid[0] += 1
    runs = text if isinstance(text, str) and text.startswith('<') else f'<hp:run charPrIDRef="0"><hp:t>{esc(text)}</hp:t></hp:run>'
    return (f'<hp:p id="{pid[0]}" paraPrIDRef="{para}" styleIDRef="{style}" pageBreak="{1 if page_break else 0}" columnBreak="0" merged="0">'
            f'{runs}</hp:p>')


def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')


def make_hwpx(path):
    header = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
<hh:head {HWPX_NS} version="1.4" secCnt="1">
<hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1" equation="1"/>
<hh:refList>
<hh:fontfaces itemCnt="2">
<hh:fontface lang="HANGUL" fontCnt="1"><hh:font id="0" face="함초롬바탕" type="TTF" isEmbedded="0"/></hh:fontface>
<hh:fontface lang="LATIN" fontCnt="1"><hh:font id="0" face="함초롬바탕" type="TTF" isEmbedded="0"/></hh:fontface>
</hh:fontfaces>
<hh:charProperties itemCnt="2">
<hh:charPr id="0" height="1000" textColor="#000000" shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="1"><hh:fontRef hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/></hh:charPr>
<hh:charPr id="1" height="1600" textColor="#000000" shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="1"><hh:fontRef hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/><hh:bold/></hh:charPr>
</hh:charProperties>
<hh:paraProperties itemCnt="2">
<hh:paraPr id="0" tabPrIDRef="0" condense="0"><hh:heading type="NONE" idRef="0" level="0"/></hh:paraPr>
<hh:paraPr id="1" tabPrIDRef="0" condense="0"><hh:heading type="OUTLINE" idRef="0" level="0"/></hh:paraPr>
</hh:paraProperties>
<hh:styles itemCnt="3">
<hh:style id="0" type="PARA" name="바탕글" engName="Normal" paraPrIDRef="0" charPrIDRef="0" nextStyleIDRef="0" langID="1042" lockForm="0"/>
<hh:style id="1" type="PARA" name="본문" engName="Body" paraPrIDRef="0" charPrIDRef="0" nextStyleIDRef="1" langID="1042" lockForm="0"/>
<hh:style id="2" type="PARA" name="개요 1" engName="Outline 1" paraPrIDRef="1" charPrIDRef="1" nextStyleIDRef="2" langID="1042" lockForm="0"/>
</hh:styles>
</hh:refList>
</hh:head>'''

    link = ('<hp:run charPrIDRef="0"><hp:t>도구 주소: </hp:t></hp:run>'
            '<hp:run charPrIDRef="0"><hp:ctrl><hp:fieldBegin id="1001" type="HYPERLINK" name="" editable="0" dirty="0" zorder="-1" fieldid="627272811">'
            '<hp:parameters cnt="3" name=""><hp:integerParam name="Prop">0</hp:integerParam>'
            '<hp:stringParam name="Command">https\\://gemini.google.com;1;0;0;</hp:stringParam>'
            '<hp:stringParam name="Path">https://gemini.google.com</hp:stringParam></hp:parameters></hp:fieldBegin></hp:ctrl>'
            '<hp:t>제미나이</hp:t><hp:ctrl><hp:fieldEnd beginIDRef="1001" fieldid="627272811"/></hp:ctrl></hp:run>')
    table = ('<hp:run charPrIDRef="0"><hp:tbl id="2001" rowCnt="2" colCnt="2" cellSpacing="0" borderFillIDRef="1">'
             + ''.join(
                 '<hp:tr>' + ''.join(
                     f'<hp:tc name="" header="0" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="1">'
                     f'<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER">'
                     f'{hp_para(v)}</hp:subList><hp:cellAddr colAddr="{c}" rowAddr="{r}"/><hp:cellSpan colSpan="1" rowSpan="1"/>'
                     f'<hp:cellSz width="20000" height="1000"/></hp:tc>' for c, v in enumerate(row)) + '</hp:tr>'
                 for r, row in enumerate([('시간', '내용'), ('15:10~15:40', '패들렛으로 의견 모으기')]))
             + '</hp:tbl></hp:run>')
    pic = ('<hp:run charPrIDRef="0"><hp:pic id="3001" zOrder="0" numberingType="PICTURE" textWrap="TOP_AND_BOTTOM">'
           '<hp:sz width="18000" widthRelTo="ABSOLUTE" height="11250" heightRelTo="ABSOLUTE" protect="0"/>'
           '<hc:img binaryItemIDRef="image1" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/>'
           '<hp:shapeComment>연수 장소 사진</hp:shapeComment></hp:pic></hp:run>')
    paras = [
        '<hp:run charPrIDRef="0"><hp:secPr id="" textDirection="HORIZONTAL" spaceColumns="1134" tabStop="8000" outlineShapeIDRef="1" memoShapeIDRef="0" textVerticalWidthHead="0" masterPageCnt="0"/></hp:run><hp:run charPrIDRef="1"><hp:t>교사 AI 연수 계획</hp:t></hp:run>',
    ]
    body = [hp_para(paras[0], style=2, para=1)]
    body += [
        hp_para('일시: 2026. 11. 4.(수) 15:10~16:40'),
        hp_para('장소: 한빛초등학교 시청각실'),
        hp_para(link),
        hp_para(table),
        hp_para(pic),
        hp_para('<hp:run charPrIDRef="1"><hp:t>실습 안내</hp:t></hp:run>', style=2, para=1, page_break=True),
        hp_para('1. 패들렛에 접속합니다.'),
        hp_para('2. 모둠별 게시판에 의견을 남깁니다.'),
        hp_para('3. 제미나이로 의견을 요약합니다.'),
        hp_para('“우리 반 의견을 세 문장으로 요약해줘”라고 입력해 보세요.'),
        hp_para('<hp:run charPrIDRef="1"><hp:t>마무리</hp:t></hp:run>', style=2, para=1),
        hp_para('<hp:run charPrIDRef="0"><hp:t>배운 점을 한 줄로 남겨 주세요.</hp:t><hp:t><hp:lineBreak/>감사합니다.</hp:t></hp:run>'),
    ]
    section = f'<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>\n<hs:sec {HWPX_NS}>' + ''.join(body) + '</hs:sec>'
    hpf = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
<opf:package {HWPX_NS} version="" unique-identifier="" id="">
<opf:metadata><opf:title>교사 AI 연수 계획</opf:title><opf:language>ko</opf:language><opf:meta name="creator" content="text">김하늘</opf:meta></opf:metadata>
<opf:manifest>
<opf:item id="header" href="Contents/header.xml" media-type="application/xml"/>
<opf:item id="image1" href="BinData/image1.png" media-type="image/png" isEmbeded="1"/>
<opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/>
<opf:item id="settings" href="settings.xml" media-type="application/xml"/>
</opf:manifest>
<opf:spine><opf:itemref idref="header" linear="yes"/><opf:itemref idref="section0" linear="yes"/></opf:spine>
</opf:package>'''
    version = ('<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>\n<hv:HCFVersion xmlns:hv="http://www.hancom.co.kr/hwpml/2011/version" '
               'tagetApplication="WORDPROCESSOR" major="5" minor="1" micro="0" buildNumber="1" os="1" xmlVersion="1.4" application="Hancom Office Hangul" appVersion="12.0.0.0"/>')
    container = ('<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>\n<ocf:container xmlns:ocf="urn:oasis:names:tc:opendocument:xmlns:container" '
                 'xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf"><ocf:rootfiles>'
                 '<ocf:rootfile full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/>'
                 '</ocf:rootfiles></ocf:container>')
    settings = '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>\n<ha:HWPApplicationSetting xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app"><ha:CaretPosition listIDRef="0" paraIDRef="0" pos="0"/></ha:HWPApplicationSetting>'
    with zipfile.ZipFile(path, 'w') as z:
        z.writestr(zipfile.ZipInfo('mimetype'), 'application/hwp+zip', compress_type=zipfile.ZIP_STORED)
        for name, data in [('version.xml', version), ('META-INF/container.xml', container), ('Contents/content.hpf', hpf),
                           ('Contents/header.xml', header), ('Contents/section0.xml', section), ('settings.xml', settings)]:
            z.writestr(name, data, compress_type=zipfile.ZIP_DEFLATED)
        z.writestr('BinData/image1.png', png(200, 125, (120, 80, 200)), compress_type=zipfile.ZIP_STORED)


MD = '''# 실습 메모

## 준비
- Google 계정 로그인
- 크롬 브라우저 열기

## 프롬프트 모음
```
역할: 너는 중학교 국어 교사야.
목표: [작품명]의 주제를 3문장으로 설명해 줘.
```

## 링크
[패들렛 보드](https://padlet.com/example/board)
'''


def main():
    pptx = os.path.join(HERE, 'workshop.pptx')
    make_pptx(pptx)
    make_docx(os.path.join(HERE, 'guide.docx'))
    make_hwpx(os.path.join(HERE, 'plan.hwpx'))
    with open(os.path.join(HERE, 'notes.md'), 'w', encoding='utf-8') as f:
        f.write(MD)
    soffice = shutil.which('soffice') or shutil.which('libreoffice')
    if soffice:
        with tempfile.TemporaryDirectory() as tmp:
            subprocess.run([soffice, f'-env:UserInstallation=file://{tmp}/profile', '--headless', '--norestore',
                            '--convert-to', 'pdf', '--outdir', tmp, pptx], check=True, capture_output=True, timeout=300)
            shutil.copy(os.path.join(tmp, 'workshop.pdf'), os.path.join(HERE, 'workshop.pdf'))
    else:
        print('soffice가 없어 workshop.pdf는 만들지 못했어요.', file=sys.stderr)
    for f in sorted(os.listdir(HERE)):
        if not f.endswith('.py'):
            print(f'{f}\t{os.path.getsize(os.path.join(HERE, f))} bytes')


if __name__ == '__main__':
    main()
