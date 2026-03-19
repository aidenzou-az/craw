export class MockFeishuSender {
  constructor() {
    this.messages = [];
  }

  async send({ userId, content }) {
    this.messages.push({
      userId,
      content,
      sentAt: new Date().toISOString(),
    });
    return { ok: true };
  }
}
