import { skillConfigJson } from './settings';

describe('skillConfigJson', () => {
  it('builds the skill config.json for this project and user', () => {
    expect(JSON.parse(skillConfigJson('uid-123'))).toEqual({ baseUrl: 'https://yuda85.github.io/kal/', projectId: 'trainerio-cf81a', uid: 'uid-123' });
  });
});
