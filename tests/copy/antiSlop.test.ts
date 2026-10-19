import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Anti-AI Slop Quality Gate', () => {
  const bannedKeywords = [
    /\bdelve\b/i,
    /\btestament\b/i,
    /\bgame-changer\b/i,
    /\bsynergize\b/i,
    /\bempower agile\b/i,
    /\bin today's fast-paced\b/i,
    /\bseamlessly integrate\b/i,
    /\bunlocking the power\b/i,
    /\brevolutionize\b/i,
    /\bworkspace dashboard\b/i,
    /\bconsensus telemetry\b/i,
    /\bCSV telemetry\b/i,
    /\bLeading choice:/i,
  ];

  const bannedBotPricingClaims = [
    /\bzero fees\b/i,
    /\bzero cost\b/i,
    /\bfree\b/i,
  ];

  const bannedBinaryContrasts = [
    /\bnot\s+[^,.]*,\s*but\b/i,
    /\bno\s+es\s+[^,.]*,\s*sino\b/i,
    /\bnot\s+just\s+[^,.]*,\s*it's\b/i,
  ];

  const botAndManifestFiles = [
    path.resolve(process.cwd(), 'manifest.json'),
    path.resolve(process.cwd(), 'src/slack/utils/channelMembers.ts'),
    path.resolve(process.cwd(), 'src/slack/ui/views/pollMessage.ts'),
    path.resolve(process.cwd(), 'src/slack/ui/views/appHome.ts'),
    path.resolve(process.cwd(), 'src/slack/ui/views/createPollModal.ts'),
    path.resolve(process.cwd(), 'src/slack/ui/views/analyticsModal.ts'),
    path.resolve(process.cwd(), 'src/slack/ui/views/templatesModal.ts'),
    path.resolve(process.cwd(), 'src/slack/ui/views/settingsModal.ts'),
    path.resolve(process.cwd(), 'src/slack/ui/views/guideModal.ts'),
    path.resolve(process.cwd(), 'src/slack/handlers/actions.ts'),
    path.resolve(process.cwd(), 'src/slack/handlers/commands.ts'),
    path.resolve(process.cwd(), 'src/slack/handlers/views.ts'),
  ];

  const targetFiles = [
    ...botAndManifestFiles,
    path.resolve(process.cwd(), 'public/privacy.html'),
    path.resolve(process.cwd(), 'public/terms.html'),
    path.resolve(process.cwd(), 'public/support.html'),
    path.resolve(process.cwd(), 'public/index.html'),
    path.resolve(process.cwd(), 'public/status/index.html'),
    path.resolve(process.cwd(), 'public/status/status.js'),
  ];

  targetFiles.forEach((file) => {
    const filename = path.basename(file);

    it(`${filename} adheres strictly to Anti-AI Slop standards`, () => {
      expect(fs.existsSync(file), `File ${filename} must exist`).toBe(true);
      const content = fs.readFileSync(file, 'utf-8');

      // Test banned corporate fluff and synthetic clichés
      for (const pattern of bannedKeywords) {
        const match = content.match(pattern);
        expect(
          match,
          `Found banned AI-slop pattern ${pattern} in ${filename}`
        ).toBeNull();
      }

      // Test binary contrast crutches ("not X, but Y")
      for (const pattern of bannedBinaryContrasts) {
        const match = content.match(pattern);
        expect(
          match,
          `Found banned binary contrast ${pattern} in ${filename}`
        ).toBeNull();
      }
    });
  });

  botAndManifestFiles.forEach((file) => {
    const filename = path.basename(file);

    it(`${filename} contains no hardcoded 'Free' or 'Zero Fees' pricing claims`, () => {
      const content = fs.readFileSync(file, 'utf-8');
      for (const pattern of bannedBotPricingClaims) {
        const match = content.match(pattern);
        expect(
          match,
          `Found hardcoded pricing claim ${pattern} in ${filename}`
        ).toBeNull();
      }
    });
  });
});
