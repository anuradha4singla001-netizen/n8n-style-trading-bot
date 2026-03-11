/**
 * Strategy Routes  –  /api/v1/strategies
 */

const router = require("express").Router();
const { body, param, validationResult } = require("express-validator");
const Store = require("../models/store");
const { runStrategy } = require("../engine/strategyEngine");
const { getMarketSnapshot } = require("../services/market.service");

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

/* GET /api/v1/strategies */
router.get("/", (req, res) => {
  res.json({ strategies: Store.getStrategies() });
});

/* GET /api/v1/strategies/:id */
router.get("/:id",
  param("id").isString(),
  validate,
  (req, res) => {
    const s = Store.getStrategy(req.params.id);
    if (!s) return res.status(404).json({ error: "Strategy not found" });
    res.json(s);
  }
);

/* POST /api/v1/strategies */
router.post("/",
  body("name").isString().notEmpty().trim(),
  body("nodes").isArray({ min: 1 }),
  body("edges").isArray(),
  validate,
  (req, res) => {
    const s = Store.createStrategy(req.body);
    res.status(201).json(s);
  }
);

/* PATCH /api/v1/strategies/:id */
router.patch("/:id",
  param("id").isString(),
  validate,
  (req, res) => {
    const updated = Store.updateStrategy(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Strategy not found" });
    res.json(updated);
  }
);

/* DELETE /api/v1/strategies/:id */
router.delete("/:id",
  param("id").isString(),
  validate,
  (req, res) => {
    const ok = Store.deleteStrategy(req.params.id);
    if (!ok) return res.status(404).json({ error: "Strategy not found" });
    res.status(204).end();
  }
);

/* POST /api/v1/strategies/:id/run  –  manual trigger */
router.post("/:id/run",
  param("id").isString(),
  validate,
  async (req, res) => {
    const strategy = Store.getStrategy(req.params.id);
    if (!strategy) return res.status(404).json({ error: "Strategy not found" });
    const snapshot = getMarketSnapshot();
    const result = await runStrategy(strategy, snapshot);
    res.json(result);
  }
);

/* POST /api/v1/strategies/:id/toggle  –  enable/disable */
router.post("/:id/toggle",
  param("id").isString(),
  validate,
  (req, res) => {
    const strategy = Store.getStrategy(req.params.id);
    if (!strategy) return res.status(404).json({ error: "Strategy not found" });
    const updated = Store.updateStrategy(req.params.id, { enabled: !strategy.enabled });
    res.json(updated);
  }
);

module.exports = router;
