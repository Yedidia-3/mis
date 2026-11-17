import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assignClassList } from './class-list-roster.ts';

const row = (name: string, studentIdNumber?: string) => ({ name, studentIdNumber });

describe('assignClassList', () => {
  it('keeps pupils on the file and takes off anyone the file does not name', () => {
    const plan = assignClassList(4, [row('AGANZE Miracle', '110836250053')], [
      { id: 1, name: 'Aganze Miracle', studentIdNumber: null, classId: 4 },
      { id: 2, name: 'UWIMANA Lea', studentIdNumber: '110836250099', classId: 4 },
    ]);
    assert.deepEqual(plan.kept.map((item) => item.id), [1]);
    assert.deepEqual(plan.added, []);
    assert.deepEqual(plan.removedIds, [2]);
  });

  it('moves a pupil onto this class by student code instead of creating another', () => {
    const plan = assignClassList(8, [row('ABAYO Celse Ghislain', '110836210420')], [
      { id: 9, name: 'Abayo Celse', studentIdNumber: '110836210420', classId: 3 },
    ]);
    assert.deepEqual(plan.moved.map((item) => item.id), [9]);
    assert.deepEqual(plan.added, []);
    assert.deepEqual(plan.removedIds, []);
  });

  it('adds a pupil the year has never had', () => {
    const plan = assignClassList(4, [row('NEW Pupil', '110836269999')], [
      { id: 1, name: 'Someone Else', studentIdNumber: '110836250001', classId: 4 },
    ]);
    assert.equal(plan.added.length, 1);
    assert.deepEqual(plan.removedIds, [1]);
  });

  it('matches accents and keeps the pupil already in the class when the name is shared', () => {
    const plan = assignClassList(5, [row('AKSANTE Anaïs')], [
      { id: 1, name: 'AKSANTE Anais', studentIdNumber: null, classId: 5 },
      { id: 2, name: 'AKSANTE Anais', studentIdNumber: null, classId: 9 },
    ]);
    assert.deepEqual(plan.kept.map((item) => item.id), [1]);
    assert.deepEqual(plan.moved, []);
    assert.deepEqual(plan.removedIds, []);
  });
});
