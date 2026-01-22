/**
 * CacheManager - 缓存管理器
 *
 * 职责：
 * - 管理场景判定结果的缓存
 * - 减少重复计算
 * - 支持缓存过期和失效
 *
 * Requirements: 需求 12.1（优化场景判定性能）
 */

/**
 * 缓存条目
 */
interface CacheEntry {
  data: any;
  timestamp: number;
  hits: number;
}

/**
 * 缓存配置
 */
interface CacheConfig {
  maxSize: number;           // 最大缓存条目数
  defaultTTL: number;        // 默认缓存过期时间（毫秒）
  cleanupInterval: number;   // 清理间隔（毫秒）
}

/**
 * 缓存统计
 */
interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

/**
 * 缓存管理器类
 */
export class CacheManager<K = string> {
  private cache: Map<K, CacheEntry> = new Map();
  private config: CacheConfig;
  private stats = { hits: 0, misses: 0 };
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: config.maxSize ?? 100,
      defaultTTL: config.defaultTTL ?? 5 * 60 * 1000, // 5分钟
      cleanupInterval: config.cleanupInterval ?? 60 * 1000, // 1分钟
    };

    // 启动定期清理
    this.startCleanup();
  }

  /**
   * 获取缓存值
   *
   * @param key 缓存键
   * @param ttl 可选的自定义过期时间
   * @returns 缓存值或 null
   */
  get<V = any>(key: K, ttl?: number): V | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // 检查是否过期
    const now = Date.now();
    const effectiveTTL = ttl ?? this.config.defaultTTL;
    if (now - entry.timestamp > effectiveTTL) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // 更新命中统计
    entry.hits++;
    this.stats.hits++;
    return entry.data;
  }

  /**
   * 设置缓存值
   *
   * @param key 缓存键
   * @param value 缓存值
   */
  set<V = any>(key: K, value: V): void {
    // 检查缓存大小，必要时清理
    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data: value,
      timestamp: Date.now(),
      hits: 0,
    });
  }

  /**
   * 删除缓存值
   *
   * @param key 缓存键
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * 检查缓存是否存在且有效
   *
   * @param key 缓存键
   * @param ttl 可选的自定义过期时间
   * @returns 是否存在且有效
   */
  has(key: K, ttl?: number): boolean {
    return this.get(key, ttl) !== null;
  }

  /**
   * 获取或计算缓存值
   * 如果缓存不存在，则调用工厂函数计算并缓存
   *
   * @param key 缓存键
   * @param factory 工厂函数
   * @param ttl 可选的自定义过期时间
   * @returns 缓存值
   */
  async getOrCompute<V = any>(
    key: K,
    factory: () => V | Promise<V>,
    ttl?: number
  ): Promise<V> {
    const cached = this.get(key, ttl);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    this.set(key, value);
    return value;
  }

  /**
   * 获取缓存统计
   *
   * @returns 缓存统计
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * 使用 LRU 策略驱逐缓存
   */
  private evictLRU(): void {
    let lruKey: K | null = null;
    let lruTime = Infinity;
    let lruHits = Infinity;

    // 找到最少使用的条目
    for (const [key, entry] of this.cache.entries()) {
      if (entry.hits < lruHits || (entry.hits === lruHits && entry.timestamp < lruTime)) {
        lruKey = key;
        lruTime = entry.timestamp;
        lruHits = entry.hits;
      }
    }

    if (lruKey !== null) {
      this.cache.delete(lruKey);
    }
  }

  /**
   * 清理过期缓存
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: K[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.config.defaultTTL) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }

    if (keysToDelete.length > 0) {
      console.log(`[CacheManager] Cleaned up ${keysToDelete.length} expired entries`);
    }
  }

  /**
   * 启动定期清理
   */
  private startCleanup(): void {
    if (this.cleanupTimer) {
      return;
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * 停止定期清理
   */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * 销毁缓存管理器
   */
  destroy(): void {
    this.stopCleanup();
    this.clear();
  }
}

/**
 * 场景缓存键生成器
 */
export class SceneCacheKeyBuilder {
  /**
   * 生成场景缓存键
   *
   * @param timestamp 时间戳
   * @param signalTypes 信号类型列表
   * @returns 缓存键
   */
  static build(timestamp: number, signalTypes: string[]): string {
    // 将时间戳四舍五入到最近的分钟，以增加缓存命中率
    const roundedTime = Math.floor(timestamp / 60000) * 60000;
    const sortedSignals = signalTypes.sort().join(',');
    return `scene:${roundedTime}:${sortedSignals}`;
  }

  /**
   * 生成规则缓存键
   *
   * @param context 场景上下文字符串
   * @returns 缓存键
   */
  static buildRulesKey(context: string): string {
    return `rules:${context}`;
  }

  /**
   * 生成应用解析缓存键
   *
   * @param intent 意图字符串
   * @returns 缓存键
   */
  static buildAppIntentKey(intent: string): string {
    return `app_intent:${intent}`;
  }
}

// 导出预配置的缓存实例
export const sceneCache = new CacheManager({
  maxSize: 50,
  defaultTTL: 2 * 60 * 1000, // 2分钟
  cleanupInterval: 30 * 1000, // 30秒
});

export const ruleCache = new CacheManager({
  maxSize: 20,
  defaultTTL: 5 * 60 * 1000, // 5分钟
  cleanupInterval: 60 * 1000, // 1分钟
});

export const appCache = new CacheManager({
  maxSize: 100,
  defaultTTL: 10 * 60 * 1000, // 10分钟
  cleanupInterval: 2 * 60 * 1000, // 2分钟
});

export default CacheManager;
