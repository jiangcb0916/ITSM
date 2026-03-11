/**
 * 忽略 node_modules 中依赖的 source map 解析错误（如 @antv/layout 等包内引用不存在的 .ts 源文件），
 * 避免 npm run build 在服务器拉代码后构建报错。
 */
module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.ignoreWarnings = [
        ...(webpackConfig.ignoreWarnings || []),
        { module: /node_modules/ },
        { message: /Failed to parse source map/ },
      ];
      return webpackConfig;
    },
  },
};
