import { Router } from 'express';
import { asyncHandler } from '../utils.js';
import { requireAdmin } from '../middleware.js';
import { getEmailSettings, isConfigured } from '../services/email.js';
import { reminderCandidates, runReminders } from '../services/reminders.js';

const router = Router();

// Factures échues, dernière relance et prochaine relance suggérée
router.get('/', asyncHandler(async (req, res) => {
  const settings = await getEmailSettings(req.company.id);
  const items = await reminderCandidates(req.company, settings);
  res.json({
    configured: isConfigured(settings),
    auto_enabled: !!settings.reminders_enabled,
    delays: [settings.reminder1_days, settings.reminder2_days, settings.reminder3_days],
    items,
  });
}));

// Envoie tout de suite les relances dues (même si les relances automatiques sont désactivées)
router.post('/run', requireAdmin, asyncHandler(async (req, res) => res.json(await runReminders(req.company, req.user))));

export default router;
