require('dotenv').config({
  path: '.env.local',
});

module.exports = {
  plugins: [
    {
      resolve: `gatsby-plugin-manifest`,
      options: {
        name: `FairyBiome chatbot`,
        short_name: `FairyBiome`,
        start_url: `/`,
        background_color: `#f7f0eb`,
        theme_color: `#a2466c`,
        display: `standalone`,
        icon: 'static/images/icon.svg',
      },
    },
    {
      resolve: `gatsby-source-filesystem`,
      options: {
        name: `userAvatar`,
        path: `${__dirname}/static/user/avatar`,
      },
    },
    {
      resolve: `gatsby-source-filesystem`,
      options: {
        name: `botAvatar`,
        path: `${__dirname}/static/chatbot/avatar`,
      },
    },
    {
      resolve: `gatsby-source-filesystem`,
      options: {
        name: `botModules`,
        path: `${__dirname}/static/chatbot/botModules`,
      },
    },
    {
      resolve: `gatsby-source-filesystem`,
      options: {
        name: `token`,
        path: `${__dirname}/static/chatbot/token`,
      },
    },
    {
      resolve: `gatsby-source-filesystem`,
      options: {
        name: `content`,
        path: `${__dirname}/src/content`,
      },
    },
    `gatsby-transformer-remark`,
    {
      resolve: `gatsby-transformer-json`,
      options: {
        typeName: `Json`,
      },
    },
  ],
  siteMetadata: {
    title: '妖精バイオーム',
    author: '加藤真一',
    backgroundColorPalette: [
      // https://www.ppgpaints.com/color/color-families/neutrals
      '#535353', // black
      '#c7b7a1', // neutral
      '#789bc5', // blue
      '#b0bf74', // green
      '#ddb763', // yellow
      '#d58b5f', // orange
      '#c4736e', // red
      '#9e88aa', // purple
    ],
    balloonBackgroundAlpha: 0.8
  },
};
