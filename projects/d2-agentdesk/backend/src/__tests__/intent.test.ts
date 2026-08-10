import { classifyIntent } from '../engine/intent';

const t = (subject: string, body = '') => classifyIntent({ subject, body });

describe('classifyIntent', () => {
  it.each([
    ['Refund for my keyboard', ''],
    ['I want my money back', ''],
    ['Chargeback request', ''],
    ['Please reimburse me', ''],
    ['Hello', 'I would like to return my order please'],
    ['Order issue', 'can you refund it'],
  ])('classifies %p / %p as a refund', (subject, body) => {
    expect(t(subject, body)).toBe('refund');
  });

  it.each([
    ['Forgot my password', 'I cannot log in'],
    ['Where is my parcel?', 'It has been a week'],
    ['Do you offer internships?', 'I am a student'],
  ])('classifies %p / %p as a question', (subject, body) => {
    expect(t(subject, body)).toBe('question');
  });

  it('is anchored on word boundaries so quoted policy text does not trip it', () => {
    expect(t('Question about policy', 'Is this item refundable in principle?')).toBe('question');
  });
});
