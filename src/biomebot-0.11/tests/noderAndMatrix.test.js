import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { botDxIo } from '../BotDxIo';
import { Noder } from '../worker/noder';
import systemTag from '../../../static/chatbot/token/system.json';
import personTag from '../../../static/chatbot/token/0000person.json';
import scriptJson from '../../../static/chatbot/botModules/fairyGirl/main.json';
import greetingScript from '../../../static/chatbot/botModules/fairyGirl/greeting.json';
import { graphqlToWordTag } from '../botio';
import { preprocess, tee, matrixize } from '../worker/matrix';
import { retrieve } from '../worker/retrieve';
import { MessageFactory } from '../../message';

describe('Noder&matrix', () => {
  const botId = 'user00Test01';

  it('fakeSystemTag', async () => {
    const wordToTag = graphqlToWordTag([systemTag.token, personTag.token]);
    await botDxIo.uploadDxWordToTagList(wordToTag);
    expect(1).toBe(1);
  });

  it('uploadDxScheme', async () => {
    await botDxIo.uploadDxScheme({
      botModules: [
        {
          fsId: 'fakeFsId',
          data: {
            ...scriptJson,
            script: [...scriptJson.script, '{BOT_NAME} しずく'],
            botId: botId,
            moduleName: 'main',
          },
        },
        {
          fsId: 'fakeFsId2',
          data: {
            ...greetingScript,
            botId: botId,
            moduleName: 'food',
          },
        },
      ],
    });

    expect(1).toBe(1);
  });

  const noder = new Noder(botId);
  it('Noder', async () => {
    await noder.loadTags();

    expect(noder.wordToTags.length).toBe(114);
    expect(noder.nameToTags.length).toBe(1);

    const nodes = noder.nodify(
      'こんにちは。しずくです。お父さんは強力です{!on_start}'
    );

    expect(nodes[4].feat).toBe('{BOT_NAME}');
  });

  // matrix
  // preprocess
  let script = [];
  it('downloadDxScript', async () => {
    script = await botDxIo.downloadDxScript('fakeFsId2');
    expect(script.length).toBe(8);
  });

  let script3;
  it('matrix-preprocess', () => {
    const validAvatars = [
      'peace',
      'absent',
      'cheer',
      'down',
      'sleep',
      'sleepy',
      'waving',
    ];
    const script2 = preprocess(script, ['peace', ...validAvatars], 'peace');
    script3 = tee(script2.script);
    expect(script3.status).toBe('ok');
  });

  let source;
  it('matrix-matrixize', () => {
    const params = { tailing: 0.7, condWeight: 1.2, timeWeight: 0.8 };
    source = matrixize(script3.inScript, params, noder);
    console.log('cMatrix', source.condMatrix);
  });

  it('set test cond tag', async () => {
    await botDxIo.writeTag('hungry', 1, botId);
    const r = await botDxIo.readTag('hungry', botId);
    expect(r).toBe(1);
  });

  it('matrix-retrieve', async () => {
    const user = {
      avatarDir: 'avatarDir',
      avatar: 'avatar',
      displayName: '名前',
    };
    const msg = new MessageFactory('{!on_start}', { user: user });
    console.log(source)

    const retrieved = await retrieve(msg, source, botId, noder);
    console.log('retrieved', retrieved);
  });
});
