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

  // The refund branch can move money and the question branch cannot, so the classifier is
  // deliberately asymmetric. These are the cases that made it that way: an earlier version
  // matched the bare word "refund" anywhere, so someone asking what the policy WAS had
  // their order refunded.
  describe('fails closed — talking about refunds is not requesting one', () => {
    it.each([
      ['What is your refund policy?', 'I want to understand the rules before I buy.'],
      ['Question about refunds', 'How long do refunds usually take to reach my bank?'],
      ['Are these headphones refundable?', 'Asking before I order anything.'],
      ['How do refunds work?', 'Curious how the process goes.'],
    ])('treats %p / %p as a question, not a refund request', (subject, body) => {
      expect(t(subject, body)).toBe('question');
    });

    it.each([
      ['Refund for my keyboard', ''],
      ['Refund please', 'it arrived broken'],
      ['Order issue', 'can you refund it'],
      ['Hello', 'I would like to return my order please'],
    ])('still routes the real request %p / %p to the refund branch', (subject, body) => {
      expect(t(subject, body)).toBe('refund');
    });
  });
});
