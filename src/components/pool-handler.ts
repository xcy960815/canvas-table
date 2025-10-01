import Konva from 'konva'

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


