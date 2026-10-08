# Android APK 与手机版

本项目主要面向手机竖屏触控，同时保留可直接访问的网页版。Android 安装包将 HTML、JavaScript 和 WAV 全部内置，没有远程页面依赖，没有广告、账号或统计 SDK。

## 安装

在 [Releases](https://github.com/PLAYNN1/jieya-yedi-xiaoyouxi/releases) 下载 `jieya-yedi-v1.3.1.apk`，支持 Android 8.0 及以上。打开后按系统提示允许当前下载来源安装。应用名称为“解压液滴小游戏”。

首次点击解锁声音。切后台停止帧循环和音效；返回键先暂停，暂停后再返回可确认退出。最高分保存在应用内部，不与网页版同步，卸载或清除应用数据会清除纪录。

## 构建

需要 Node.js、JDK 17 或更高版本（此版本用 JDK 21 构建）、Android SDK Platform 36 和 Build Tools 35.0.0 或更新版本。可用 Android Studio 打开 `android/`，也可以：

```sh
cd android
./gradlew assembleDebug
./gradlew assembleRelease
```

Windows 使用 `gradlew.bat`。请设置 `JAVA_HOME`、`ANDROID_HOME`，或在未提交的 `android/local.properties` 中填写本机 `sdk.dir`。

Gradle 会自动执行 `tools/sync-android.js`，使用与网页版相同的运行文件。Debug 安装包位于 `android/app/build/outputs/apk/debug/app-debug.apk`；Release 的未签名包位于 `android/app/build/outputs/apk/release/app-release-unsigned.apk`。

## 签名

在仓库根目录执行：

```sh
node tools/sign-android.js
```

脚本首次运行会在 `.private/android-signing/` 生成此项目专用密钥与密码文件，使用它签名，并输出 APK、签名验证结果及 SHA-256 校验文件到 `outputs/`。后续运行沿用同一密钥。**维护者需要备份整个 `.private/android-signing/`，后续覆盖安装更新需要同一签名；该目录不会上传到 GitHub。**不要将其他项目的密钥复制进来。

他人自行构建时可生成自己的密钥；其安装包不能直接覆盖维护者签名的已安装版本。GitHub Actions 提供的 debug APK 同样用于开发检查，正式下载入口使用 Releases 的维护者签名包。

更新版本时修改根目录 `package.json` 的版本号以及 `android/app/build.gradle` 的 `versionCode`，重新构建、签名后发布。

## 实现与验证范围

原生 Java Activity 使用 [Android 官方推荐的 WebViewAssetLoader](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content) 以本地 HTTPS 来源加载资源，让音频 fetch 和本地存储正常工作。应用不申请 INTERNET 权限，不启用本地文件访问或 JavaScript 原生桥，外部请求被拦截。框架依赖为 AndroidX WebKit，游戏逻辑仍在 `src/`。

已执行 APK 构建、签名验证及打包资源检查，并简短验证手机浏览器触控与缩放。当前没有连接 Android 设备，未完成真机安装、刘海屏实测或长时间运行验收；声音响度、低端机流畅度和不同系统的安装体验需要实际试玩。
