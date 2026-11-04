import { defaultTeachingModel } from './teaching-model';

describe('defaultTeachingModel', () => {
  it('keeps nursery and P1–P2 as class teacher', () => {
    for (const name of ['N1', 'N2', 'N3', 'P1', 'P2', 'p 2']) {
      expect(defaultTeachingModel(name)).toBe('class_teacher');
    }
  });

  it('makes P3–P6 specialist so one class can have several subject teachers', () => {
    for (const name of ['P3', 'P4', 'P5', 'P6', 'p3', 'P 4']) {
      expect(defaultTeachingModel(name)).toBe('specialist');
    }
  });

  it('defaults unknown labels to class teacher', () => {
    expect(defaultTeachingModel('Reception')).toBe('class_teacher');
    expect(defaultTeachingModel('S1')).toBe('class_teacher');
  });
});
