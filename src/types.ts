export type Category = 'critical' | 'transactional' | 'semantic';
export type PluginFixTier = 'free' | 'pro' | 'manual';

export interface AuditCheck {
  id: string;
  name: string;
  description: string;
  category: Category;
  maxScore: number;
  score: number;
  passed: boolean;
  pluginFix: PluginFixTier;
  howToFix: string;
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
