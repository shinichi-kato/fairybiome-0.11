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
 * 環境からの入力
 *  const m = new Message(text, {ecosys: true})
 *  天候や場所が変化したことを伝えるトリガ情報をtextにタグとして
 *  伝達する。
 *
 * システムメッセージ
 *  const m = new Message(text);
 * ユーザのログインログアウトなど
 */
export class MessageFactory {
  /**
   * コンストラクタ. user,bot,ecosysはいずれか一つまたはなし
   * @param {String} data メッセージ文字列
   * @param {Object} prop.user auth.userReprオブジェクト
   * @param {Object} prop.bot botReprオブジェクト
   * @param {Object} prop.ecosys ecosysオブジェクト
   */
  constructor(data, {user, bot, ecosys, timestamp}) {
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
      this.text = data;
      this.timestamp = timestamp || new Date();

      if (user) {
        this.kind = 'user';
        this.avatarDir = user.avatarDir;
        this.avatar = user.avatar;
        this.ownerId = user.uid;
        this.backgroundColor = user.backgroundColor;
        this.displayName = user.displayName;
        this.ecoState = ecosys || null;
      } else if (bot) {
        this.kind = 'bot';
        this.avatarDir = bot.avatarDir;
        this.ownerId = bot.botId;
        this.avatar = bot.avatar;
        this.displayName = bot.displayName;
        this.backgroudColor = bot.backgroundColor;
        this.ecoState = ecosys || null;
      } else if (ecosys === true) {
        this.kind = 'ecosys';
        this.avatarDir = null;
        this.ownerId = null;
        this.avatar = null;
        this.backgroundColor = null;
        this.displayName = null;
        this.ecoState = null;
        // 伝達内容はtext
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
      background: this.background,
      displayName: this.displayName,
      ecoState: this.ecoState,
    };
  }
}
