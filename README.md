# FairyBiome

複数のパートが並列動作して会話を行うチャットボットBiomeBotとのチャット

# 特徴

# Requirements

* Firebase sparkアカウント(無料)
* node.js v20.13.1

# インストール

1. ソースコードのダウンロード
githubからローカルにソースをcloneしてください。

2. nvm環境設定(任意)
nvmを利用することでnodeのバージョン制御を行うと便利です。ソースを展開したディレクトリで

```
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
```
を実行し、nvmをインストールします。

```
nvm use
```
で必要なバージョンのnodeがインストールされます。

3. パッケージのインストール
```
npm intall
```
で実行に必要なパッケージをインストールします。

3. firebase設定
[firebase](https://firebase.google.com/?hl=ja)にアカウントを用意します。規模が小さければ無料プランで開始できます。つづいて[Firebase を JavaScript プロジェクトに追加する](https://firebase.google.com/docs/web/setup?hl=ja)を参考にfirebase上にプロジェクトを作成してください。

[firebase CLIをインストールする](https://firebase.google.com/docs/cli?hl=ja#mac-linux-auto-script)を参照して
以下のコマンドを実行してください。

```
curl -sL https://firebase.tools | bash
firebase login
```

プロジェクトディレクトリに`.env.local`というファイルを作成し、firebaseから取得したクレデンシャル情報を以下のように転記します。Gatsbyではプログラム内で使える環境変数は先頭がGATSBY_から始まっている必要があるため、以下のような名前にします。
```
  GATSBY_FIREBASE_API_KEY=xxxxxxxxxxxxxxxxxxxxxxx-xxxxxxxxxxxxxxx
  GATSBY_FIREBASE_AUTH_DOMAIN=xxxxxxxxxxxxxx.firebaseapp.com
  GATSBY_FIREBASE_PROJECT_ID=xxxxxxxxxxxxxx
  GATSBY_FIREBASE_STORAGE_BUCKET=xxxxxxxxxxxxxx.appspot.com
  GATSBY_FIREBASE_MESSAGING_SENDER_ID=000000000000
  GATSBY_FIREBASE_APP_ID=0:000000000000:web:xxxxxxxxxxxxxxxxxxxxxx
  GATSBY_FIREBASE_MEASUREMENT_ID=x-xxxxxxxxxx
```

さらにソースコードをgithub上に置く場合はリポジトリ本体にはセキュリティのためクレデンシャル情報を置かず、変わりに
Settings - Secrets and variables - Repository secretsに以下の変数を作り、
firebaseから取得したクレデンシャルを転記します。

```
GATSBY_FIREBASE_API_KEY
GATSBY_FIREBASE_AUTH_DOMAIN
GATSBY_FIREBASE_PROJECT_ID
GATSBY_FIREBASE_STORAGE_BUCKET
GATSBY_FIREBASE_MESSAGING_SENDER_ID
GATSBY_FIREBASE_APP_ID
GATSBY_FIREBASE_MEASUREMENT_ID
```

4. テスト
```
gatsby develop
```
とするとソースコードのコンパイルが行われ、問題なければローカルでアプリが起動します。

5. ビルド
github上ではfirebaseへのデプロイも自動化されているため、おすすめです。その場合githubへプッシュするだけでfirebase上でのビルドとデプロイが進みます。

# Usage

# Note