import re

from docx import Document


class Loader:
    def __init__(self, path: str):
        self.path = path
        self.markdown = []

    def word_parser(self):
        doc = Document(self.path)
        for paragraph in doc.paragraphs:
            style_name = paragraph.style.name
            if style_name.startswith('Heading'):
                match = re.match(r'Heading (\d+)', style_name)
                if level := match.group(1):
                    self.markdown.append('{} {}'.format(int(level) * '#', paragraph.text))
            elif style_name.startswith('toc'):
                continue
            else:
                self.markdown.append(paragraph.text)
        return self.markdown

    def load(self) -> str:
        if self.path.endswith(".docx"):
            self.word_parser()
        else:
            raise ValueError("暂不支持其他格式")
        return "\n\n".join(self.markdown)
