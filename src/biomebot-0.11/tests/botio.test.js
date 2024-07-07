import 'fake-indexeddb/auto';
import {describe, expect, it} from 'vitest';
import {botDxIo} from '../BotDxIo';

describe('bot i/o', () => {
  const now = new Date();
  const scheme = {
    updatedAt: now,
    botModules: [
      {
        fsId: 'testFsId1',
        data: {
          botId: 'user00Test01',
          schemeName: 'Test01',
          moduleName: 'main',
          updatedAt: now,
          avatarDir: 'FairyGirl',
          backgroundColor: '#2366ed',
          alarms: {
            monday: {
              year: null,
              month: null,
              date: null,
              day: 'Monday',
              hour: null,
              min: null,
            },
          },
          script: [
            '{BOT_NAME} しずく',
            '{RESPONSE_INTERVALS} 300,400',
            '{AWAKENING_HOUR} 8, 7',
            '{BEDTIME_HOUR} 22',
            '{I} 私,あたし',
            '{YOU} きみ,君',
            '{TEST} {TEST2}です',
          ],
        },
      },
      {
        fsId: 'testFsId2',
        data: {
          botId: 'user00Test01',
          schemeName: 'Test01',
          moduleName: 'greeting',
          updatedAt: now,
          script: [
            '{TEST2} リンゴ',
            'with {!greeting}',
            'user こんにちは',
            'bot こんにちは{+greeting}',
          ],
        },
      },
    ],
  };

  it('uploadDxScheme', async () => {
    await botDxIo.uploadDxScheme(scheme);
    expect(1).toBe(1);
  });

  it('downloadDxScheme', async () => {
    const data = await botDxIo.downloadDxScheme('user00Test01');
    expect(data.botModules.length).toBe(2);
  });

  it('downloadDxScript', async () => {
    const ms = await botDxIo.downloadDxScript('testFsId2');
    expect(ms.length).toBe(3);
  });

  it('checkMemory', async () => {
    const mem = await botDxIo.readTag('{BOT_NAME}', 'user00Test01');
    console.log(mem);
    expect(mem.length).toBe(1);
  });

  it('decodeTag', async () => {
    const result = await botDxIo.decodeTag(
      '{TEST}',
      'user00Test01',
      'greeting'
    );
    console.log(result);
    expect(result).toBe('リンゴです');
  });
});
