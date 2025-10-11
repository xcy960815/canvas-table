import Konva from 'konva'

/**
 * 通用类型工具：美化类型显示
 */
export type Prettify<T> = {
    [K in keyof T]: T[K]
} & {}
/**
 * 对象池 属性
 */
export interface KonvaNodePools {
    /**
     * 单元格矩形
     */
    cellRects: Konva.Rect[]
    /**
     * 单元格文本
     */
    cellTexts: Konva.Text[]
}

/**
 * 清理对象池
 * @param {Konva.Node[]} pool 对象池
 * @returns {void}
 */
export const clearPool = (pool: Konva.Node[]) => {
    pool.forEach((node) => node.destroy())
    pool.length = 0
}

/**
 * 对象池：获取或创建对象
 * @param {T[]} pools 对象池
 * @param {() => T} createPoolHandler 创建函数
 * @returns {T}
 */
export const getFromPool = <T extends Konva.Node>(pools: T[], createPoolHandler: () => T): T => {
    let pooledNode = pools.pop()
    if (!pooledNode) {
        pooledNode = createPoolHandler()
    }
    return pooledNode
}

/**
 * 回收 Konva 节点
 * @param pool 对象池
 * @param node 对象
 * @returns {void}
 */
export const returnToPool = <T extends Konva.Node>(pool: T[], node: T) => {
    node.remove()
    pool.push(node)
}

/**
 * 优化的节点回收 - 批量处理减少遍历次数
 * @param {Konva.Group} bodyGroup - 分组
 * @param {KonvaNodePools} pools - 对象池
 * @returns {void}
 */
export const recoverKonvaNode = (bodyGroup: Konva.Group, pools: KonvaNodePools) => {
    // 清空当前组，将对象返回池中
    const children = bodyGroup.children.slice()
    const textsToRecover: Konva.Text[] = []
    const rectsToRecover: Konva.Rect[] = []

    // 分类收集需要回收的节点
    children.forEach((child: Konva.Node) => {
        if (child instanceof Konva.Text) {
            const name = child.name()
            // 处理合并单元格和普通单元格文本节点回收
            if (name === 'merged-cell-text' || name === 'cell-text') {
                textsToRecover.push(child)
            }
        } else if (child instanceof Konva.Rect) {
            const name = child.name()
            // 处理合并单元格和普通单元格矩形节点回收
            if (name === 'merged-cell-rect' || name === 'cell-rect') {
                rectsToRecover.push(child)
            }
        }
    })

    // 批量回收
    textsToRecover.forEach((text) => returnToPool(pools.cellTexts, text))
    rectsToRecover.forEach((rect) => returnToPool(pools.cellRects, rect))
}
/**
 * 获取容器元素
 * @returns {HTMLDivElement | null} 容器元素
 */
export const getTableContainer = (): HTMLDivElement | null => {
    return document.getElementById('table-container') as HTMLDivElement | null
}

/**
 * 将数值约束到指定区间 [min, max]
 * @param n 数值
 * @param min 最小值
 * @param max 最大值
 * @returns 限制后的数值
 */
export const constrainToRange = (n: number, min: number, max: number) => {
    return Math.max(min, Math.min(max, n))
}

/**
 * 超出最大宽度时裁剪文本，并追加省略号
 * @param text 文本
 * @param maxWidth 最大宽度
 * @param fontSize 字体大小
 * @param fontFamily 字体
 * @returns 裁剪后的文本
 */
export const truncateText = (text: string, maxWidth: number, fontSize: number, fontFamily: string): string => {
    // 创建一个临时文本节点来测量文本宽度
    const tempTextNode = new Konva.Text({
        text: text,
        fontSize: fontSize,
        fontFamily: fontFamily
    })

    // 如果文本宽度小于等于 maxWidth，直接返回
    if (tempTextNode.width() <= maxWidth) {
        tempTextNode.destroy()
        return text
    }

    // 二分查找，找到最大可容纳的字符数
    let left = 0
    let right = text.length
    let result = ''

    while (left <= right) {
        const mid = Math.floor((left + right) / 2)
        const testText = text.substring(0, mid) + '...'

        tempTextNode.text(testText)

        if (tempTextNode.width() <= maxWidth) {
            result = testText
            left = mid + 1
        } else {
            right = mid - 1
        }
    }

    tempTextNode.destroy()
    return result || '...'
}

/**
 * 绘制文本配置接口
 */
export interface DrawTextConfig {
    pools?: KonvaNodePools
    name: string
    text: string
    x: number
    y: number
    height: number
    width: number
    fontSize: number
    fontFamily: string
    fill: string
    align: 'left' | 'center' | 'right'
    verticalAlign: 'top' | 'middle' | 'bottom'
    group: Konva.Group
}

/**
 * 绘制矩形配置接口
 */
export interface DrawRectConfig {
    name: string
    x: number
    y: number
    width: number
    height: number
    fill: string
    stroke: string
    strokeWidth: number
    group: Konva.Group
    cornerRadius?: number
    listening?: boolean
    pools?: KonvaNodePools
}

/**
 * 绘制文本
 * @param {DrawTextConfig} config - 绘制文本配置
 * @returns {Konva.Text} 文本节点
 */
export const drawUnifiedText = (config: DrawTextConfig) => {
    const {
        pools,
        name,
        text,
        x,
        y,
        fontSize,
        fontFamily,
        fill,
        align,
        verticalAlign,
        height,
        width,
        group
    } = config

    // 创建或复用文本节点
    const textNode = pools
        ? getFromPool(pools.cellTexts, () => new Konva.Text({ listening: false, name }))
        : new Konva.Text({
            name,
            text,
            x,
            y,
            fontSize,
            fontFamily,
            fill,
            align,
            verticalAlign,
            width,
            height,
            listening: false
        })

    // 统一设置属性（仅在使用对象池时需要更新所有属性）
    if (pools) {
        textNode.text(text)
        textNode.fontSize(fontSize)
        textNode.fontFamily(fontFamily)
        textNode.fill(fill)
        textNode.align(align)
        textNode.verticalAlign(verticalAlign)
    }

    // 处理水平对齐
    if (align === 'center') {
        textNode.x(x + width / 2)
        textNode.offsetX(textNode.width() / 2)
    } else if (align === 'right') {
        textNode.x(x + width - 8)
    } else {
        textNode.x(x + 8)
    }

    // 处理垂直对齐
    if (verticalAlign === 'middle') {
        textNode.y(y + height / 2)
        textNode.offsetY(textNode.height() / 2)
    } else {
        textNode.y(y)
    }

    group.add(textNode)
    return textNode
}

/**
 * 绘制矩形
 * @param {DrawRectConfig} config - 绘制矩形配置
 * @returns {Konva.Rect} 矩形节点
 */
export const drawUnifiedRect = (config: DrawRectConfig): Konva.Rect => {
    const { pools, name, x, y, width, height, fill, stroke, strokeWidth, cornerRadius, listening, group } = config
    // 创建或复用矩形节点
    const rectNode = pools
        ? getFromPool(pools.cellRects, () => new Konva.Rect({ listening, name }))
        : new Konva.Rect({ listening, name })

    // 移除旧的事件监听器（避免对象池复用时累积事件）
    rectNode.off('click')
    rectNode.off('mouseenter')
    rectNode.off('mouseleave')

    // 统一设置属性
    rectNode.setAttrs({
        x,
        y,
        width,
        height,
        fill,
        stroke,
        strokeWidth,
        cornerRadius
    })

    group.add(rectNode)
    
    return rectNode
}

/**
 * 获取单元格显示值
 * @param {GroupStore.GroupOption | DimensionStore.DimensionOption} columnOption - 列配置
 * @param {ChartDataVo.ChartData} row - 行数据
 * @param {number} rowIndex - 行索引
 * @returns {string} 显示值
 */
export const getCellDisplayValue = (
    columnOption: GroupStore.GroupOption | DimensionStore.DimensionOption,
    row: ChartDataVo.ChartData,
    rowIndex: number
) => {
    const rawValue =
        columnOption.columnName === '__index__'
            ? String(rowIndex + 1)
            : row && typeof row === 'object'
                ? row[columnOption.columnName]
                : undefined
    return String(rawValue ?? '')
}

/**
 * 设置指针样式的辅助函数
 * @param {boolean} on - 是否显示指针
 * @param {string} cursor - 指针样式
 */
export const setPointerStyle = (stage: Konva.Stage | null, on: boolean, cursor: string) => {
    if (stage) stage.container().style.cursor = on ? cursor : 'default'
}

interface ClipOptions {
    x: number
    y: number
    width: number
    height: number
}

/**
 * 统一的分组创建工厂方法
 * @param {'header' | 'body' | 'summary' | 'scrollbar'} groupType - 分组类型
 * @param {'left' | 'center' | 'right' | 'vertical' | 'horizontal'} position - 左中右位置或滚动条方向
 * @param {number} x - x坐标
 * @param {number} y - y坐标
 * @param {Object} [options] - 可选配置（如裁剪参数）
 * @param {number} options.x - 裁剪x坐标
 * @param {number} options.y - 裁剪y坐标
 * @param {number} options.width - 裁剪宽度
 * @param {number} options.height - 裁剪高度
 * @returns {Konva.Group}
 */
export const createGroup = (
    groupType: 'header' | 'body' | 'summary' | 'scrollbar',
    position: 'left' | 'center' | 'right' | 'vertical' | 'horizontal',
    x: number = 0,
    y: number = 0,
    clip?: ClipOptions
): Konva.Group => {

    const groupName = groupType === 'scrollbar'
        ? `${position}-${groupType}-group`
        : `${position}-${groupType}${clip ? '-clip' : ''}-group`

    const groupConfig: Konva.GroupConfig = {
        fill: 'red',
        x: position === 'left' ? 0 : x, // 左侧固定列的x永远为0
        y: position === 'center' && groupType !== 'header' ? y : groupType === 'header' ? 0 : y,
        name: groupName
    }

    // 如果是裁剪组，添加裁剪配置
    if (clip) {
        groupConfig.clip = clip
    }

    return new Konva.Group(groupConfig)
}