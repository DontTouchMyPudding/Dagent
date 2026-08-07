from typing import List


class SplitterConfig:
    def __init__(self, chunk_size: int, chunk_overlap: int, separator: str):
        assert chunk_overlap < chunk_size, "chunk_overlap 必须小于 chunk_size"
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separator = separator


class TextSplitter:
    def __init__(self, config: SplitterConfig = None):
        self.config = config or SplitterConfig(500, 10, "\n\n")

    def split_text(self, text: str) -> List[str]:
        chunks = []
        start = 0
        text_length = len(text)

        while start < text_length:
            end = start + self.config.chunk_size
            chunk = text[start:end]
            if end < text_length:
                chunk = self._adjust_to_sentence_boundary(chunk)
            chunks.append(chunk)
            step = len(chunk) - self.config.chunk_overlap
            if step <= 0:
                step = self.config.chunk_size
            start += step
        return chunks

    def _adjust_to_sentence_boundary(self, chunk: str) -> str:
        last_step = chunk.rfind(self.config.separator)
        if last_step > self.config.chunk_size // 2:
            return chunk[:last_step]
        for sep in ['。', '！', '？', '. ', '! ', '? ']:
            last_step = chunk.rfind(sep)
            if last_step > self.config.chunk_size // 2:
                return chunk[:last_step + len(sep)]
        return chunk


class RecursiveTextSplitter:
    def __init__(self, chunk_size: int, chunk_overlap: int, separators: List[str]):
        assert chunk_overlap < chunk_size, "chunk_overlap 必须小于 chunk_size"
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separators = separators

    def split_text(self, text: str) -> List[str]:
        return self._split(text, self.separators)

    def _split(self, text: str, separators: List[str]) -> List[str]:
        separator = self._pick_separator(text, separators)
        remaining = separators[separators.index(separator) + 1:]

        splits = text.split(separator) if separator else list(text)
        chunks = []
        pending = []

        for split in splits:
            if len(split) > self.chunk_size:
                if pending:
                    chunks.extend(self._merge(pending, separator))
                    pending = []
                chunks.extend(self._split(split, remaining))
            else:
                pending.append(split)

        if pending:
            chunks.extend(self._merge(pending, separator))

        return chunks

    def _pick_separator(self, text: str, separators: List[str]) -> str:
        for sep in separators:
            if sep == "" or sep in text:
                return sep
        return separators[-1]

    def _merge(self, splits: List[str], separator: str) -> List[str]:
        chunks = []
        current_parts: List[str] = []
        current_len = 0
        for part in splits:
            part_len = len(part)
            sep_len = len(separator) if current_parts else 0
            if current_len + sep_len + part_len > self.chunk_size and current_parts:
                chunks.append(separator.join(current_parts))
                current_parts, current_len = self._trim_overlap(current_parts, separator)

            current_parts.append(part)
            current_len = len(separator.join(current_parts))

        if current_parts:
            chunks.append(separator.join(current_parts))

        return chunks

    def _trim_overlap(self, parts: List[str], separator: str):
        while parts:
            current_len = len(separator.join(parts))
            if current_len <= self.chunk_overlap:
                break
            parts.pop(0)
        return parts, len(separator.join(parts))
