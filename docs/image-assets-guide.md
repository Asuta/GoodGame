# 图片资源说明

这份文档说明项目当前需要哪些图片、应该放到哪里，以及建议使用什么像素尺寸。

## 图片放在哪里

如果你在编辑器里把场景图片 URL 留空，项目会自动从下面的位置读取本地图片：

```text
public/images/scenes/<scene-id>/background.png
public/images/scenes/<scene-id>/character.png
public/images/scenes/<scene-id>/portrait.png
```

默认两个场景目前对应的是：

```text
public/images/scenes/room-night/background.png
public/images/scenes/room-night/character.png
public/images/scenes/room-night/portrait.png

public/images/scenes/street-dawn/background.png
public/images/scenes/street-dawn/character.png
public/images/scenes/street-dawn/portrait.png
```

你可以直接用自己的正式图片覆盖这些同名占位文件。

## 每个文件分别放什么内容

每个场景目录下的三张图，分别代表不同图层：

- `background.png`：场景背景图，只放环境
- `character.png`：叠在背景上的角色立绘，建议透明底 PNG
- `portrait.png`：角色近景头像或半身像，当前主要作为预留资源

### `room-night`

- `background.png`
  - 内容：卧室 / 房间夜晚背景
  - 可以包含床、桌子、窗户、灯光、室内摆设等
  - 不建议把主角色大图直接画进背景里

- `character.png`
  - 内容：夜晚房间场景中的角色立绘
  - 建议透明底
  - 可以是全身、半身或三分之二身

- `portrait.png`
  - 内容：这个场景对应的角色近景头像或上半身特写
  - 表情可以偏安静、戒备、疲惫、柔和等

### `street-dawn`

- `background.png`
  - 内容：清晨街道背景
  - 可以包含街道、建筑、天空、晨雾、路面、招牌等
  - 同样不建议把主角色直接合进背景图

- `character.png`
  - 内容：清晨街道场景中的角色立绘
  - 建议透明底
  - 氛围最好和户外清晨光线一致

- `portrait.png`
  - 内容：这个场景对应的角色近景头像或半身像
  - 可以和室内场景共用同一套角色风格，但表情或光影可以不同

## 关于尺寸的说明

项目目前不会强制限制图片像素大小。

这些尺寸不是硬性要求，而是根据当前界面布局得出的推荐值。按这些尺寸出图，通常能避免模糊、裁切不自然或文件过大的问题。

## 背景图 `background.png`

- 用途：试玩页的大场景背景
- 渲染方式：`object-cover`
- 显示区域比例：`16:10`
- 推荐格式：
  - 偏照片或厚涂背景：`jpg`
  - 需要无损细节：`png`

推荐尺寸：

- 最低建议：`1600 x 1000`
- 标准推荐：`1920 x 1200`
- 高质量版本：`2560 x 1600`

注意事项：

- 因为背景使用的是 `object-cover`，不同屏幕下边缘可能会被轻微裁掉
- 重要元素尽量不要贴边放
- 建议把视觉重点放在画面中间安全区域

## 角色立绘 `character.png`

- 用途：叠在背景上的主角色图层
- 渲染方式：`object-contain object-bottom`
- 推荐格式：透明底 `png`

推荐尺寸：

- 最低建议：`1000 x 1400`
- 标准推荐：`1400 x 2000`
- 高质量版本：`1800 x 2600`

注意事项：

- 最适合做成透明底的全身或半身立绘
- 因为使用 `object-contain`，整张图会尽量完整显示，不会像背景那样大幅裁切
- 因为底部对齐，人物脚部或画面最低点尽量靠近画布底边
- 如果姿势较宽，左右可以适当留一点透明边距

## 头像图 `portrait.png`

- 用途：预留资源，未来可用于头像框、对话头像、资料面板等
- 当前状态：主界面暂时没有强依赖它，但建议先准备好
- 推荐格式：`png`

推荐尺寸：

- 最低建议：`512 x 512`
- 标准推荐：`1024 x 1024`

注意事项：

- 最稳妥的是正方形头像或上半身近景
- 因为当前主界面还没有正式大量使用它，所以构图要求相对宽松

## 命名规则

每个场景目录里固定使用这三个文件名：

- `background.png`
- `character.png`
- `portrait.png`

目录名必须和场景 id 完全一致。

例如：

- 场景 id 是 `room-night`，那背景图路径就是 `public/images/scenes/room-night/background.png`
- 场景 id 是 `street-dawn`，那角色立绘路径就是 `public/images/scenes/street-dawn/character.png`

## 如果你新增了场景

如果你在编辑器里新增一个场景，id 叫 `clinic-sunset`，那么它对应的本地自动读取路径就是：

```text
public/images/scenes/clinic-sunset/background.png
public/images/scenes/clinic-sunset/character.png
public/images/scenes/clinic-sunset/portrait.png
```

如果编辑器里手动填写了 URL，就会优先使用你填写的 URL；只有在留空时，才会走本地 `public` 目录的自动读取逻辑。

## 给美术最省事的一套推荐出图规格

如果你现在只想给美术一套简单明确的标准，可以直接用下面这一组：

- 背景图：`1920 x 1200`
- 角色立绘：`1400 x 2000`，透明 PNG
- 头像图：`1024 x 1024`

这套规格和当前项目的界面适配度比较高，也不会让文件体积大得太夸张。
