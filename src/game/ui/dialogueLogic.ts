export interface DialogueChoice {
    id: string;
    label: string;
}

export interface DialogueEntry {
    speaker?: string;
    text: string;
    choices?: readonly DialogueChoice[];
}

export interface DialoguePage {
    speaker?: string;
    text: string;
    choices: readonly DialogueChoice[];
}

export const DEFAULT_DIALOGUE_PAGE_LENGTH = 180;

export function paginateDialogueText(
    text: string,
    maxCharacters = DEFAULT_DIALOGUE_PAGE_LENGTH
): string[] {
    if (!Number.isInteger(maxCharacters) || maxCharacters < 1) {
        throw new RangeError('maxCharacters must be a positive integer');
    }

    const normalized = text.replace(/\r\n?/g, '\n').trim();
    if (normalized.length === 0) {
        return [''];
    }

    const pages: string[] = [];
    let page = '';

    const pushPage = (): void => {
        pages.push(page.trim());
        page = '';
    };

    for (const token of normalized.split(/(\s+)/).filter(Boolean)) {
        const whitespace = /^\s+$/.test(token);
        const normalizedToken = whitespace
            ? (token.includes('\n') ? '\n' : ' ')
            : token;

        if (whitespace && page.length === 0) {
            continue;
        }

        if (page.length + normalizedToken.length <= maxCharacters) {
            page += normalizedToken;
            continue;
        }

        if (whitespace) {
            pushPage();
            continue;
        }

        if (page.length > 0) {
            pushPage();
        }

        let remainder = normalizedToken;
        while (remainder.length > maxCharacters) {
            pages.push(remainder.slice(0, maxCharacters));
            remainder = remainder.slice(maxCharacters);
        }
        page = remainder;
    }

    if (page.length > 0 || pages.length === 0) {
        pushPage();
    }

    return pages;
}

export function buildDialoguePages(
    entries: readonly DialogueEntry[],
    maxCharacters = DEFAULT_DIALOGUE_PAGE_LENGTH
): DialoguePage[] {
    return entries.flatMap((entry) => {
        const textPages = paginateDialogueText(entry.text, maxCharacters);
        return textPages.map((text, index) => ({
            speaker: entry.speaker,
            text,
            choices: index === textPages.length - 1 ? entry.choices ?? [] : []
        }));
    });
}

export function moveChoiceSelection(
    currentIndex: number,
    direction: -1 | 1,
    choiceCount: number
): number {
    if (!Number.isInteger(choiceCount) || choiceCount < 1) {
        return -1;
    }

    const safeIndex = currentIndex >= 0 && currentIndex < choiceCount ? currentIndex : 0;
    return (safeIndex + direction + choiceCount) % choiceCount;
}

export function getSelectedChoice(
    choices: readonly DialogueChoice[],
    selectedIndex: number
): DialogueChoice | undefined {
    return choices[selectedIndex];
}
