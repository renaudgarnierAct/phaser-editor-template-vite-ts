import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildDialoguePages,
    getSelectedChoice,
    moveChoiceSelection,
    paginateDialogueText,
    type DialogueChoice
} from '../dialogueLogic.ts';

test('paginateDialogueText wraps on words without losing content', () => {
    const pages = paginateDialogueText('Alpha beta gamma delta', 11);

    assert.deepEqual(pages, ['Alpha beta', 'gamma delta']);
    assert.equal(pages.join(' '), 'Alpha beta gamma delta');
});

test('paginateDialogueText splits a word longer than the page limit', () => {
    assert.deepEqual(paginateDialogueText('abcdefgh', 3), ['abc', 'def', 'gh']);
});

test('buildDialoguePages keeps choices only on the final page of an entry', () => {
    const choices: DialogueChoice[] = [{ id: 'yes', label: 'Yes' }];
    const pages = buildDialoguePages([
        { speaker: 'Guide', text: 'One two three four', choices }
    ], 7);

    assert.equal(pages.length, 3);
    assert.equal(pages[0]?.speaker, 'Guide');
    assert.deepEqual(pages[0]?.choices, []);
    assert.deepEqual(pages[1]?.choices, []);
    assert.deepEqual(pages[2]?.choices, choices);
});

test('moveChoiceSelection wraps in both directions', () => {
    assert.equal(moveChoiceSelection(0, -1, 3), 2);
    assert.equal(moveChoiceSelection(2, 1, 3), 0);
    assert.equal(moveChoiceSelection(1, 1, 3), 2);
    assert.equal(moveChoiceSelection(0, 1, 0), -1);
});

test('getSelectedChoice returns the selected choice or undefined', () => {
    const choices: DialogueChoice[] = [
        { id: 'wait', label: 'Wait' },
        { id: 'fight', label: 'Fight' }
    ];

    assert.deepEqual(getSelectedChoice(choices, 1), choices[1]);
    assert.equal(getSelectedChoice(choices, -1), undefined);
    assert.equal(getSelectedChoice(choices, 2), undefined);
});
