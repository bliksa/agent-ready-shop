export type Category = 'critical' | 'transactional' | 'semantic';
export type PluginFixTier = 'free' | 'pro' | 'manual';
export type CheckId = 'robots' | 'schema' | 'llms' | 'feed' | 'api' | 'agent';

/** Structural part of a check. Its copy is localised — see checkCopy() in data/auditConfig. */
export interface AuditCheck {
  id: CheckId;
  category: Category;
  maxScore: number;
  score: number;
  passed: boolean;
  pluginFix: PluginFixTier;
}

export interface AuditResult {
  url: string;
  platform: string;
  isWooCommerce: boolean;
  pluginDetected: boolean;
  botBlocked: boolean;
  productPage: string | null;
  totalScore: number;
  checks: AuditCheck[];
}
