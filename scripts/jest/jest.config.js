const { defaults } = require('jest-config');

module.exports = {
	...defaults,
	// 命令执行下的根目录
	rootDir: process.cwd(),
	// <rootDir>其实就是项目的更目录， modulePathIgnorePatterns这个是忽略
	modulePathIgnorePatterns: ['<rootDir>/.history'],
	//
	moduleDirectories: [
		// 对于 React ReactDOM
		'dist/node_modules',
		// 对于第三方依赖
		...defaults.moduleDirectories
	],
	// 用到的环境
	testEnvironment: 'jsdom'
};
