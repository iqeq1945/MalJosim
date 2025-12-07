import { Injectable } from "@nestjs/common";

/**
 * Trie 노드 인터페이스
 */
interface TrieNode {
  children: Map<string, TrieNode>;
  isEndOfWord: boolean;
  wordInfo?: {
    word: string;
    normalizedWord: string;
    id: string;
    severity: string;
  };
}

/**
 * Trie 기반 금칙어 매칭 서비스
 *
 * 슬라이딩 윈도우 방식의 다중 Redis 조회를 대체하여
 * 한 번의 텍스트 순회로 모든 매칭을 찾습니다.
 * 글로벌 금칙어만 관리하며, 클라이언트별 맞춤형 기능은 지원하지 않습니다.
 */
@Injectable()
export class TrieService {
  private globalTrie: TrieNode = this.createNode();

  /**
   * 새로운 Trie 노드를 생성합니다.
   */
  private createNode(): TrieNode {
    return {
      children: new Map(),
      isEndOfWord: false,
    };
  }

  /**
   * 글로벌 Trie에 금칙어를 추가합니다.
   *
   * @param normalizedWord 정규화된 단어
   * @param wordInfo 단어 정보
   */
  addWord(
    normalizedWord: string,
    wordInfo: {
      word: string;
      normalizedWord: string;
      id: string;
      severity: string;
    }
  ): void {
    let node = this.globalTrie;

    for (const char of normalizedWord) {
      if (!node.children.has(char)) {
        node.children.set(char, this.createNode());
      }
      node = node.children.get(char)!;
    }

    node.isEndOfWord = true;
    node.wordInfo = wordInfo;
  }

  /**
   * Trie에서 단어를 제거합니다.
   *
   * @param normalizedWord 정규화된 단어
   */
  removeWord(normalizedWord: string): void {
    this.removeWordFromTrie(this.globalTrie, normalizedWord, 0);
  }

  /**
   * Trie에서 단어를 재귀적으로 제거합니다.
   */
  private removeWordFromTrie(
    node: TrieNode,
    word: string,
    index: number
  ): boolean {
    if (index === word.length) {
      if (!node.isEndOfWord) {
        return false;
      }
      node.isEndOfWord = false;
      node.wordInfo = undefined;
      return node.children.size === 0;
    }

    const char = word[index];
    const child = node.children.get(char);

    if (!child) {
      return false;
    }

    const shouldDelete = this.removeWordFromTrie(child, word, index + 1);

    if (shouldDelete) {
      node.children.delete(char);
      return node.children.size === 0 && !node.isEndOfWord;
    }

    return false;
  }

  /**
   * 특정 단어가 Trie에 존재하는지 확인하고 정보를 반환합니다.
   *
   * @param normalizedWord 정규화된 단어
   * @returns 단어 정보 (없으면 null)
   */
  findWord(normalizedWord: string): {
    word: string;
    normalizedWord: string;
    id: string;
    severity: string;
  } | null {
    let node = this.globalTrie;
    for (const char of normalizedWord) {
      const child = node.children.get(char);
      if (!child) {
        return null;
      }
      node = child;
    }

    if (node.isEndOfWord && node.wordInfo) {
      return {
        word: node.wordInfo.word,
        normalizedWord: node.wordInfo.normalizedWord,
        id: node.wordInfo.id,
        severity: node.wordInfo.severity,
      };
    }

    return null;
  }

  /**
   * 텍스트에서 모든 매칭된 금칙어를 찾습니다.
   *
   * @param text 검색할 텍스트
   * @returns 매칭된 단어 정보 배열
   */
  findAllMatches(text: string): Array<{
    word: string;
    normalizedWord: string;
    id: string;
    severity: string;
    startIndex: number;
    endIndex: number;
  }> {
    const matches: Array<{
      word: string;
      normalizedWord: string;
      id: string;
      severity: string;
      startIndex: number;
      endIndex: number;
    }> = [];

    // 글로벌 Trie로 매칭
    this.findMatchesInTrie(text, this.globalTrie, matches);

    // 중복 제거 (같은 위치, 같은 단어)
    return this.deduplicateMatches(matches);
  }

  /**
   * 특정 Trie에서 텍스트의 모든 매칭을 찾습니다.
   */
  private findMatchesInTrie(
    text: string,
    trie: TrieNode,
    matches: Array<{
      word: string;
      normalizedWord: string;
      id: string;
      severity: string;
      startIndex: number;
      endIndex: number;
    }>
  ): void {
    for (let i = 0; i < text.length; i++) {
      let node = trie;

      for (let j = i; j < text.length; j++) {
        const char = text[j];
        const child = node.children.get(char);

        if (!child) {
          break;
        }

        node = child;

        // 단어 끝에 도달하면 매칭 추가
        if (node.isEndOfWord && node.wordInfo) {
          matches.push({
            word: node.wordInfo.word,
            normalizedWord: node.wordInfo.normalizedWord,
            id: node.wordInfo.id,
            severity: node.wordInfo.severity,
            startIndex: i,
            endIndex: j + 1,
          });
        }
      }
    }
  }

  /**
   * 중복 매칭을 제거합니다.
   * 같은 위치에서 같은 단어가 여러 번 매칭되는 경우를 제거합니다.
   */
  private deduplicateMatches(
    matches: Array<{
      word: string;
      normalizedWord: string;
      id: string;
      severity: string;
      startIndex: number;
      endIndex: number;
    }>
  ): Array<{
    word: string;
    normalizedWord: string;
    id: string;
    severity: string;
    startIndex: number;
    endIndex: number;
  }> {
    const seen = new Set<string>();
    const unique: typeof matches = [];

    for (const match of matches) {
      const key = `${match.normalizedWord}:${match.startIndex}:${match.endIndex}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(match);
      }
    }

    return unique;
  }

  /**
   * Trie를 초기화합니다 (모든 단어 제거).
   */
  clear(): void {
    this.globalTrie = this.createNode();
  }
}
