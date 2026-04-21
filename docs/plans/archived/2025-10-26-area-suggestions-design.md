# Area Suggestions Design

**Date**: 2025-10-26
**Status**: Design
**Context**: First-run onboarding for area creation in mapping mode

---

## Purpose

Users need conscious ownership of their areas. We provide 8 suggestions based on positive psychology research, presented once during initial setup. Users click to add, creating endowment effect through active choice.

---

## The 8 Suggestions

### Core List

1. **Work** - Professional endeavors, career, value creation
2. **Health** - Physical wellness, fitness, nutrition, medical care
3. **Relationships** - Family, friends, romance, community
4. **Growth** - Learning, skill development, personal development
5. **Rest** - Recovery, sleep, downtime, restoration
6. **Play** - Recreation, hobbies, leisure, fun without purpose
7. **Purpose** - Meaning-making, contribution, service, spiritual practice
8. **Finance** - Money management, financial planning, economic wellness

### Rationale: Why These 8

These domains cover the essential dimensions of human flourishing identified by positive psychology research while remaining practical and universal.

**Coverage of PERMA Model** (Seligman, 2011):
- **P**ositive emotion: Play
- **E**ngagement: Work, Growth
- **R**elationships: Relationships
- **M**eaning: Purpose
- **A**ccomplishment: Work, Growth

**Balanced attention allocation**:
- Productive: Work, Finance
- Restorative: Rest, Health
- Connective: Relationships
- Developmental: Growth, Purpose
- Joyful: Play

**Universal applicability**: Every human allocates consciousness across these domains, regardless of culture, age, or circumstance.

**Room for refinement**: These broad categories invite natural subdivision. Health becomes Fitness, Mindfulness, Nutrition. Work becomes Craft, Projects, Career. The system expects and enables this evolution.

---

## Research Foundations

### Positive Psychology Literature

**PERMA Model** (Seligman, 2011)
Martin Seligman's well-being theory identifies five core elements of psychological flourishing. Our suggestions map directly to these elements, ensuring users can allocate attention to research-validated dimensions of well-being.

**Self-Determination Theory** (Deci & Ryan, 2000)
Three psychological needs drive intrinsic motivation: Autonomy, Competence, Relatedness. Our suggestions support these needs:
- Autonomy: Purpose, Growth, Play
- Competence: Work, Growth, Finance
- Relatedness: Relationships

**Life Domain Satisfaction** (Diener et al., 1999)
Well-being research measures satisfaction across life domains. Our suggestions align with validated domain categories while using accessible language.

**Rest and Recovery** (Sonnentag & Fritz, 2007)
Research on psychological detachment and recovery emphasizes rest as distinct from leisure. We separate Rest (restoration) from Play (recreation) to honor this distinction.

**Financial Well-Being** (Netemeyer et al., 2018)
Financial stress affects psychological health across domains. Including Finance acknowledges money as a dimension of attention requiring conscious allocation.

### Why 8, Not More

**Cognitive load**: Research on working memory suggests 7±2 items as the limit for immediate recall (Miller, 1956). Eight suggestions balance comprehensiveness with manageability.

**YAGNI principle**: Users can create unlimited areas. These 8 provide starting templates, not exhaustive categories.

**Endowment effect**: Psychological ownership increases with active choice (Kahneman et al., 1990). Too many options create analysis paralysis, reducing intentional selection.

---

## Design Decisions

### Presentation

**Flat list of 8 clickable suggestions** in mapping mode modal on first use.

Rejected alternatives:
- Grouped by domain: Added complexity without value
- Two-tier with "show more": Implied hierarchy we don't need
- Tags with search: Overkill for 8 items

### Behavioral Flow

1. User enters mapping mode for first time
2. System displays 8 area suggestions as clickable pills
3. User clicks suggestions to create areas (one-click creation)
4. Each click creates area with default color and emoji
5. Suggestions persist until user creates first area
6. After first area creation, suggestions remain visible but non-primary
7. In subsequent sessions, autocomplete suggests area names if user types matching text

### Relationship to Defaults

**No default areas on first launch.** The current 5 defaults (Wellness, Craft, Social, Joyful, Introspective) conflict with endowment effect. Users must actively choose areas to create ownership.

Rejected alternative: Keep current defaults plus show suggestions. This undermines conscious choice by pre-filling attention slots.

### Adaptation Strategy

**Static suggestions, not adaptive.** Same 8 appear for all users.

Rejected alternatives:
- Filter out existing areas: Unnecessary complexity for one-time use
- Suggest complementary areas: Requires semantic understanding and adds decision burden
- Deprioritize similar areas: Premature optimization

---

## Implementation Notes

### Data Structure

```typescript
const AREA_SUGGESTIONS = [
  { name: 'Work', color: '#3b82f6', emoji: '💼' },
  { name: 'Health', color: '#10b981', emoji: '🏃' },
  { name: 'Relationships', color: '#f97316', emoji: '❤️' },
  { name: 'Growth', color: '#8b5cf6', emoji: '📚' },
  { name: 'Rest', color: '#6366f1', emoji: '😴' },
  { name: 'Play', color: '#eab308', emoji: '🎮' },
  { name: 'Purpose', color: '#ec4899', emoji: '✨' },
  { name: 'Finance', color: '#14b8a6', emoji: '💰' },
]
```

### User State Tracking

Track whether user has seen area suggestions using local storage flag:
```typescript
hasSeenAreaSuggestions: boolean
```

Set to `true` after first area creation from suggestions or manual creation.

### Autocomplete Behavior

After `hasSeenAreaSuggestions === true`:
- Don't show suggestion pills prominently
- Enable autocomplete when user types in area name field
- Match typed text against suggestion names (case-insensitive)
- Show matching suggestions as autocomplete dropdown
- User can ignore and create custom area

---

## Alignment with Attentive Tech Principles

**Downstream allocation**: User fills own attention slots; system provides templates but doesn't pre-fill.

**Convivial constraints**: Accessible (simple list), adaptable (user creates what resonates), human-scale (8 options, not overwhelming).

**Anti-measurement**: No tracking of which suggestions users choose; no analytics on area usage.

**Consciousness as currency**: Each suggestion represents a fundamental dimension of conscious attention allocation.

**Infrastructure, not experience**: Boring by design; suggestions fade after first use; system gets out of the way.

---

## Success Criteria

**Qualitative measures**:
- Do users create areas during onboarding, or skip?
- Do created areas reflect suggestions, or diverge immediately?
- Do users refine broad areas into specific ones over time?
- Does the 8-suggestion list feel overwhelming or helpful?

**User testing questions**:
- "Which of these 8 domains resonated with you?"
- "Were any important life areas missing from suggestions?"
- "Did you feel pressure to use suggestions, or freedom to ignore them?"
- "How did creating areas make you think about attention allocation?"

---

## References

Deci, E. L., & Ryan, R. M. (2000). The "what" and "why" of goal pursuits: Human needs and the self-determination of behavior. *Psychological Inquiry, 11*(4), 227-268.

Diener, E., Suh, E. M., Lucas, R. E., & Smith, H. L. (1999). Subjective well-being: Three decades of progress. *Psychological Bulletin, 125*(2), 276-302.

Kahneman, D., Knetsch, J. L., & Thaler, R. H. (1990). Experimental tests of the endowment effect and the Coase theorem. *Journal of Political Economy, 98*(6), 1325-1348.

Miller, G. A. (1956). The magical number seven, plus or minus two: Some limits on our capacity for processing information. *Psychological Review, 63*(2), 81-97.

Netemeyer, R. G., Warmath, D., Fernandes, D., & Lynch Jr, J. G. (2018). How am I doing? Perceived financial well-being, its potential antecedents, and its relation to overall well-being. *Journal of Consumer Research, 45*(1), 68-89.

Seligman, M. E. (2011). *Flourish: A visionary new understanding of happiness and well-being*. New York: Free Press.

Sonnentag, S., & Fritz, C. (2007). The recovery experience questionnaire: Development and validation of a measure for assessing recuperation and unwinding from work. *Journal of Occupational Health Psychology, 12*(3), 204-221.

---

## Next Steps

1. Design mockup of suggestion pills in mapping mode
2. Implement suggestion click → area creation flow
3. Implement `hasSeenAreaSuggestions` flag and conditional display
4. Implement autocomplete with suggestion matching
5. User testing: observe first-time area creation behavior
6. Iterate based on qualitative feedback
