# V-Sky

## 概要

Vue.js + SkyWay によるビデオチャットツールです。  
お手持ちのサーバーにデプロイしてご利用ください。  

[Sample page](https://ukkz.github.io/v-sky)  
※サンプルページの利用は知らない人とつながる可能性がありますのでご注意ください。

## 使い方
```
npm install
```

`.env.sample` を `.env.local` としてコピーし、以下の項目を自身で取得したものに置き換えてください。  

[必須]

- SkyWay APIKEY

[任意]

- LIFF AppID（LINEログイン）

### ローカルサーバー起動
```
npm run serve
```

`.env.local` を作らないとちゃんと動作しません。  

### ビルド
```
npm run build
```

ビルドされたファイルは `dist` ではなく `docs` ディレクトリに格納されます。

## 注意点

社内専用チャットツールのような **クローズドな環境内での利用を想定した設計** をしているため、一般向けサービスには向きません。  

- シグナリング後に全てのPeerとデータ接続してルーム情報を交換している
- 誰でも匿名でログインできる

## 修正したいところ

- カメラ・マイクのいずれかがなくても利用できるようにする

## アップデート予定

- チャット
- 背景を消す
- その他のSNSログイン
- 文字起こし
- QRコード共有
- YouTubeを同時視聴
- 多言語対応
