import path from 'path';
import fs from 'fs';
import cjs from '@rollup/plugin-commonjs';
import tsc from '@rollup/plugin-typescript';
import replace from '@rollup/plugin-replace';

// 开发环境包的位置
const pkgPath = path.resolve(__dirname, '../../packages');
// 生产环境包的位置
const distPath = path.resolve(__dirname, '../../dist/node_modules');

console.log(distPath);

/**
 * 根据报名获取路径
 * @param {*} pkgName 包名
 * @param {*} isDist 是否是打包后
 */
export function resolvePkgPath(pkgName, isDist) {
	if (isDist) {
		return `${distPath}/${pkgName}`;
	}
	return `${pkgPath}/${pkgName}`;
}

// 传递包名获取包配置
export function getPackageJSON(pkgName) {
	// package.json的路径
	const path = `${resolvePkgPath(pkgName)}/package.json`;
	// 读取文件拿到字符串
	const str = fs.readFileSync(path, { encoding: 'utf-8' });
	return JSON.parse(str);
}

// 插件
export function getBaseRollupPlugins({
	alias = {
		__DEV__: true,
		preventAssignment: true
	},
	typescript = {}
} = {}) {
	return [replace(alias), cjs(), tsc(typescript)];
}
