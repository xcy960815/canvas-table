

/**
 * 获取容器元素
 * @returns {HTMLDivElement | null} 容器元素
 */
export const getTableContainer = (): HTMLDivElement | null => {
    return document.getElementById('table-container') as HTMLDivElement | null
}