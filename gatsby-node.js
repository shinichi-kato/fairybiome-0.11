exports.onCreateWebpackConfig = ({ actions: { replaceWebpackConfig }, getConfig }) => {
  const config = getConfig()

  config.module.rules.push({
    test: /\.worker\.js$/,
    use: {
      loader: 'worker-loader',
      // options: {
      //   inline: "no-fallback"
      // }
    }
  })

  replaceWebpackConfig(config)
}