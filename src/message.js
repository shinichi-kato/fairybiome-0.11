/**
 * Message クラス
 * ===============================
 *
 * ユーザやチャットボットの発言、環境からの入力、システムメッセージ
 * ユーザ発言：
 *  const m = new Message(text, {user:auth.user, ecosys:ecoState})
 *
 * ボット発言：
 *  const m = new Message(text, {bot:botState, ecosys:ecoState});
 *
 * それ以外からの入力
 *  const m = new Message(text, {cue: true})
 *  天候や場所が変化したことを伝えるキュー情報や{!on_start}のような
 *  タグをtextにして伝達する。
 *
 * システムメッセージ
 *  const m = new Message(text);
 * ユーザのログインログアウトなど
 */
export class MessageFactory {
  /**
   * コンストラクタ. user,bot,ecosysはいずれか一つまたはなし
   * @param {String} data メッセージ文字列
   * @param {Object} prop.user auth.userオブジェクト
   * @param {Object} prop.bot botReprオブジェクト
   * @param {Object} prop.ecosys ecosysオブジェクト
   */
  constructor(data, {user, bot, cue, ecosys, timestamp}) {
    if (!data) {
      this.text = '';
      this.kind = '';
      this.avatarDir = null;
      this.backgroundColor = null;
      this.displayName = null;
      this.ecoState = null;
      this.timestamp = new Date();
    } else if (typeof data === 'object') {
      this.text = data.text;
      this.kind = data.kind;
      this.avatarDir = data.avatarDir;
      this.ownerId = data.uid;
      this.backgroundColor = data.backgroundColor;
      this.displayName = data.displayName;
      this.ecoState = data.ecoState;
      this.timestamp = data.timestamp;
    } else {
      this.timestamp = timestamp || new Date();
      this.text = data;
      if (bot) {
        this.kind = 'bot';
        this.avatarDir = bot.avatarDir;
        this.ownerId = bot.ownerId;
        this.avatar = bot.avatar;
        this.displayName = bot.displayName;
        this.backgroundColor = bot.backgroundColor;
        this.ecoState = ecosys || null;
      } else if (user) {
        this.kind = 'user';
        this.avatarDir = user.avatarDir;
        this.avatar = user.avatar;
        this.ownerId = user.uid;
        this.backgroundColor = user.backgroundColor;
        this.displayName = user.displayName;
        this.ecoState = ecosys || null;
      } else if (cue === true) {
        this.kind = 'cue';
        this.avatarDir = null;
        this.ownerId = null;
        this.avatar = null;
        this.backgroundColor = null;
        this.displayName = null;
        this.ecoState = null;
      } else {
        this.kind = 'system';
        this.avatarDir = null;
        this.ownerId = null;
        this.avatar = null;
        this.backgroundColor = null;
        this.displayName = null;
        this.ecoState = null;
      }
    }
  }

  /**
   * MessageFactoryをObject型に変換
   * @return {Object} ojbect repr
   */
  toObject() {
    return {
      text: this.text,
      kind: this.kind,
      avatarDir: this.avatarDir,
      ownerId: this.ownerId,
      avatar: this.avatar,
      backgroundColor: this.backgroundColor,
      displayName: this.displayName,
      ecoState: this.ecoState,
      timestamp: this.timestamp,
    };
  }
}
