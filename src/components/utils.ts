import Konva from 'konva'

/**
 * 获取容器元素
 * @returns {HTMLDivElement | null} 容器元素
 */
export const getTableContainer = (): HTMLDivElement | null => {
    return document.getElementById('table-container') as HTMLDivElement | null
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
 * @param pool 对象池
 * @param createFn 创建函数
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
 * 文本起始 X 坐标（包含左侧 8px 内边距）
 * @param x 文本起始 X 坐标
 * @returns 文本起始 X 坐标（包含左侧 8px 内边距）
 */
export const getTextX = (x: number) => {
    return x + 8
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
 * 超出最大宽度时裁剪文本，并追加省略号
 * @param text 文本
 * @param maxWidth 最大宽度
 * @param fontSize 字体大小
 * @param fontFamily 字体
 * @returns 裁剪后的文本
 */
export const truncateText = (text: string, maxWidth: number, fontSize: number | string, fontFamily: string): string => {
    fontSize = typeof fontSize === 'string' ? Number(fontSize) : fontSize
    // 创建一个临时文本节点来测量文本宽度
    const tempText = new Konva.Text({
        text: text,
        fontSize: fontSize,
        fontFamily: fontFamily
    })

    // 如果文本宽度小于等于 maxWidth，直接返回
    if (tempText.width() <= maxWidth) {
        tempText.destroy()
        return text
    }

    // 二分查找，找到最大可容纳的字符数
    let left = 0
    let right = text.length
    let result = ''

    while (left <= right) {
        const mid = Math.floor((left + right) / 2)
        const testText = text.substring(0, mid) + '...'

        tempText.text(testText)

        if (tempText.width() <= maxWidth) {
            result = testText
            left = mid + 1
        } else {
            right = mid - 1
        }
    }

    tempText.destroy()
    return result || '...'
}