# HRV ↔ Digital Dynamism: Literature Review

> Deep-research sweep (110 agents, 27 sources, 122 claims extracted, 25 adversarially verified — 24 confirmed, 1 refuted). Conducted 2026-09-08.
>
> Companion exploration: [Body ↔ Screen artifact](https://claude.ai/code/artifact/9663f4f9-aa6e-468d-8d2f-aceb55dcea92)

## Summary

The literature supports four of five queries partially:

1. **Multitasking → SNS activation**: meta-analytically confirmed. **Reverse arrow (SNS → switching): untested.**
2. **Resting HRV ↔ executive function**: r=0.19 (meta-analysis, k=13), domain-specific to cognitive inhibition and flexibility. **Overnight HRV → next-day performance: untested.**
3. **Input patterns as stress proxies**: population-level models fail (best 59% at N=994); personalized models show promise (ρ=0.296 vs. 0.078 universal).
4. **Cognitive load → HRV suppression**: confirmed. Multitasking does not trigger HPA-axis (cortisol) — autonomic cost is real but below full-blown stress.
5. **Circadian modulation of stress-attention coupling**: no empirical evidence found.

---

## Verified findings

### F1: HRV ↔ Executive Function (high confidence)

Resting vagally-mediated HRV has a small, domain-specific association with executive function (meta-analytic r=0.19), predicting cognitive inhibition and flexibility more than working memory, but the relationship is not mediated by a shared prefrontal mechanism as neurovisceral integration theory predicts.

**Evidence:** Meta-analysis (r=0.19, 95% CI .15-.23, p<.0001) confirmed the association exists but is small. Sub-analysis showed cognitive inhibition and flexibility drove the effect; working memory did not reach significance. An independent N=440 study found HRV and cerebral blood flow contributed independently to cognition, failing to support integrated central control. HRV was primarily sensitive to sustained attention demands rather than specific cognitive processes when measured task-evoked (state) rather than at rest (trait). The HRV-cognition link appears to be about attentional control capacity, not general intelligence. No study tested overnight HRV predicting next-day performance — all evidence is concurrent or resting-state.

**Sources:**
- Magnon et al. 2022, Cortex (meta-analysis, k=13): https://www.sciencedirect.com/science/article/abs/pii/S0010945222002076
- Keary et al. 2015, Psychophysiology (N=440): https://pmc.ncbi.nlm.nih.gov/articles/PMC4387874/
- Luque-Casado et al. 2016, Biological Psychology: https://www.sciencedirect.com/science/article/abs/pii/S0301051115300880

### F2: Multitasking → Autonomic Shift (high confidence)

Cognitive load and multitasking measurably suppress parasympathetic activity and increase sympathetic activation, with HRV decreasing as a function of task demands. Multitasking does not trigger HPA-axis (cortisol) responses, suggesting the autonomic cost of digital multitasking is real but operates below the threshold of full-blown stress.

**Evidence:** A meta-analysis found SNS activity significantly higher and PNS activity significantly lower during dual/multitasking vs single-tasking. A follow-up RCT (N=192) confirmed SNS activation via salivary alpha-amylase for interruptions, dual-tasking, and multitasking conditions, and confirmed no significant cortisol changes — the HPA axis stays quiet, consistent with Dickerson & Kemeny's social-evaluative threat requirement for cortisol. Separately, HRV decreased with cognitive task demands, with lowest values during working memory tasks vs psychomotor vigilance and duration discrimination.

**Sources:**
- Becker et al. 2022, Health Psychology Review (meta-analysis): https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0263785
- Luque-Casado et al. 2016, Biological Psychology: https://www.sciencedirect.com/science/article/abs/pii/S0301051115300880
- Becker et al. 2023, Psychoneuroendocrinology (RCT, N=192)

### F3: Mouse Dynamics — Population Failure, Personal Promise (medium confidence)

Population-level mouse movement models fail as stress proxies (best ML accuracy 59% at N=994, all effect sizes η² < .01), and prior positive findings may reflect publication bias. However, specific interaction patterns (speed-accuracy trade-off, OR=1.53) and biomechanical models (MSD damped frequency, ~70% within-subject accuracy) show that a real but subtle signal exists in mouse dynamics — it is just too individual and context-dependent for a universal detector.

**Evidence:** The largest study (N=994) ran 59 mixed ANOVAs and ML classifiers, finding no systematic mouse-stress relationship — all η² values below .01, only 1/59 ANOVAs survived Bonferroni, best ML at 59%. Against this, a 7-week field study (N=70, 1829 recordings) found a significant speed-accuracy trade-off interaction (mean -0.32, 95% HPD -0.58 to -0.08). A CHI 2014 lab study found MSD-modeled mouse metrics produced significant stress discrimination where concurrent ECG-derived HRV did not, achieving ~70% within-subject accuracy.

**Sources:**
- Freihaut et al. 2021, Behavior Research Methods (N=994, null result): https://link.springer.com/article/10.3758/s13428-021-01568-8
- Hirschi et al. 2021, JMIR (N=70, 7-week field): https://pmc.ncbi.nlm.nih.gov/articles/PMC8052599/
- Sun, Paredes & Canny 2014, CHI (MouStress): https://people.eecs.berkeley.edu/~jfc/papers/14/CHI_MS14.pdf

### F4: Keystroke Dynamics as Stress Proxies (medium confidence)

Keystroke dynamics (dwell time, flight time, error rates, typing rhythm stability, trigraph timing) carry a measurable stress signal and can serve as unobtrusive, no-hardware proxies for stress detection, with classification accuracy moderate in controlled settings but degrading ecologically.

**Evidence:** Multiple studies since 2009 have found stress introduces measurable deviations in keystroke timing features. Accuracy is typically 62-75% binary in controlled settings. Per-user calibration is required. Ecological validity is limited.

**Sources:**
- Vizer, Zhou & Sears 2009: https://www.researchgate.net/publication/221518780_Detecting_cognitive_and_physical_stress_through_typing_behavior
- Carneiro et al. ~2015, Springer LNCS: https://link.springer.com/chapter/10.1007/978-3-319-14654-6_13
- Epp et al. 2011, Hernandez et al. 2014 (corroborating)

### F5: Personalized Models Vastly Outperform Universal (medium confidence)

The stress-to-input-behavior mapping is highly individual: personalized ML models using mouse and keyboard features achieve average Spearman ρ of 0.296 for stress detection while universal one-fits-all models achieve only ρ 0.078. No single feature is important across the majority of participants. In field conditions, behavioral input features outperformed wearable HRV for stress detection due to motion artifacts degrading PPG-based HRV quality.

**Evidence:** An 8-week field study found personalized models (ρ=0.296) vastly outperformed universal models (ρ=0.078). Feature importance was idiosyncratic: trigraph typing dynamics were most important for only ~25% of participants, mouse angle/acceleration for ~20%. Note: this is a preprint (Stutz et al. 2025, medRxiv), not peer-reviewed.

**Sources:**
- Stutz et al. 2025 (preprint), medRxiv (N=36): https://www.medrxiv.org/content/10.1101/2025.08.02.25332538.full.pdf
- Freihaut et al. 2021 (corroborating universal model failure)
- Sun et al. 2014 CHI (corroborating within-subject superiority)

---

## Refuted claim

**"HRV shows a significant decrement as a function of time-on-task"** — voted 0-3. HRV decreases with task *demand level*, not duration. Prolonged cognitive engagement alone does not progressively suppress autonomic variability regardless of task type.

Source: https://www.sciencedirect.com/science/article/abs/pii/S0301051115300880

---

## Caveats

1. **Directionality gap**: All multitasking-ANS studies measured switching → physiology, never the reverse. The causal arrow from physiology to digital behavior remains untested.
2. **No overnight-predictive studies**: The trait-level HRV-cognition association does not establish a day-to-day predictive relationship.
3. **Circadian modulation entirely absent**: No empirical study, despite strong theoretical reasons.
4. **Input-proxy research fragmented**: Spans 2009-2025 with no standardized replication. Personalized models explain only ~8.8% of variance.
5. **Field vs. lab validity**: Positive keystroke/mouse findings mostly come from controlled settings; field studies show substantially degraded performance.
6. **Preprint risk**: The 2025 medRxiv study (F5) is not peer-reviewed.

---

## Open questions from the literature

1. Does elevated SNS (from poor recovery, overnight HRV suppression, or acute stress) causally predict increased task-switching in digital work — or does the arrow only run from multitasking to ANS disruption?
2. Is there circadian modulation of the stress-attention coupling — does the same level of autonomic arousal impair attentional control differently at 9am vs. 3pm?
3. Can personalized input-behavior stress models (ρ=0.296) be bootstrapped from a short calibration period and maintain accuracy over months?
4. What is the minimum sensor fusion (wearable HRV + keystroke dynamics + time-of-day) needed for clinically meaningful stress detection (AUC > 0.80) without per-user training?

---

## All sources consulted

| # | Source | Quality | Angle | Claims |
|---|--------|---------|-------|--------|
| 1 | Keary et al. 2015, Psychophysiology (N=440) | primary | Psychophysiology | 5 |
| 2 | Luque-Casado et al. 2016, Biological Psychology | primary | Psychophysiology | 4 |
| 3 | Magnon et al. 2022, Cortex (meta-analysis) | primary | Psychophysiology | 4 |
| 4 | Becker et al. 2022, PLoS ONE (meta-analysis) | primary | Psychophysiology | 5 |
| 5 | Freihaut et al. 2021, Behavior Research Methods | primary | Digital phenotyping | 5 |
| 6 | Hirschi et al. 2021, JMIR | primary | Digital phenotyping | 5 |
| 7 | Stutz et al. 2025 (preprint), medRxiv | primary | Digital phenotyping | 5 |
| 8 | Carneiro et al. ~2015, Springer LNCS | primary | Digital phenotyping | 4 |
| 9 | Vizer, Zhou & Sears 2009 | primary | Digital phenotyping | 4 |
| 10 | Sun, Paredes & Canny 2014, CHI | primary | Digital phenotyping | 5 |
| 11 | Frontiers in Neuroscience 2023 | secondary | Wearable recovery | 4 |
| 12 | Sleep 2012 | primary | Wearable recovery | 4 |
| 13 | PMC 2025 | primary | Wearable recovery | 5 |
| 14 | bioRxiv 2025 | primary | Wearable recovery | 5 |
| 15 | PubMed 2025 | primary | Wearable recovery | 5 |
| 16 | PMC 2025 | primary | Wearable recovery | 5 |
| 17 | PMC 2024 | secondary | Circadian modulation | 5 |
| 18 | PMC 2023 | primary | Circadian modulation | 4 |
| 19 | Frontiers in Physiology 2025 | primary | Circadian modulation | 5 |
| 20 | Becker et al. 2022, Health Psychology Review | primary | Systematic reviews | 4 |
| 21 | PMC 2019 | secondary | Systematic reviews | 5 |
| 22 | Biological Psychology 2024 | secondary | Systematic reviews | 5 |
