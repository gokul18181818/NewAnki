# 🧪 Adaptive Features Testing Guide

## ⚡ Quick Test (5 minutes)

### Start the app and check console logs:
```bash
npm run dev
```

1. **Login/Sign up** as a new user
2. **Open browser console** (F12)
3. **Go to Settings page** - look for:
   - AI suggestions appearing next to break duration/session length
   - "AI Learning Insights" section (click the brain icon hints)
4. **Check console for**:
   - `"Personalization engine initialized"`
   - `"Profile created from history"` or `"Loaded existing profile"`

### ✅ Success indicators:
- No errors in console
- AI suggestions show up in Settings
- Learning insights panel appears when clicking brain icons

---

## 🎯 Feature-by-Feature Testing

### **1. Adaptive Milestones**
**What to test**: Dynamic milestone thresholds

**Steps**:
1. Start a study session
2. **For new users**: First milestone should be 25 cards (not 100)
3. **For experienced users**: Check if milestone adapts to your study velocity
4. Complete cards until you hit a milestone
5. **Look for**: Milestone celebration popup should show personalized threshold

**Expected behavior**:
- New users: Lower milestones (25, 75, 150...)
- Fast learners: Higher milestones (120, 300, 600...)
- Slow learners: Smaller increments (17, 50, 105...)

### **2. Dynamic Celebration Triggers**
**What to test**: Celebration frequency adaptation

**Steps**:
1. Start studying and answer cards correctly
2. **New users**: Should celebrate every 3-4 correct answers
3. **Experienced users**: Should celebrate every 5-7 correct answers
4. **Look for**: "🔥 X correct in a row!" popup frequency

**Test different scenarios**:
```
New user (low retention): Every 3 correct → 🎉
Average user: Every 5 correct → 🎉  
Expert user (high retention): Every 7 correct → 🎉
```

### **3. Adaptive Fatigue Warnings**
**What to test**: Personalized fatigue thresholds

**Steps**:
1. Study for 15+ minutes continuously
2. **Check console** for fatigue score: `"Fatigue detected (X%)"`
3. **New users**: Warning should appear around 55-60%
4. **Experienced users**: Warning might not appear until 70-75%

**To force fatigue** (for testing):
- Answer cards very slowly (10+ seconds each)
- Answer several cards incorrectly in a row
- Study without breaks for 20+ minutes

### **4. Personalized Break Recommendations**
**What to test**: AI-suggested break durations

**Steps**:
1. Go to **Settings > Study tab**
2. **Look for**: "AI suggests: Xmin" next to break duration
3. **New users**: Should suggest 5-8 minutes
4. **Long-session users**: Should suggest 10-15 minutes
5. Click "Use AI suggestion" button

### **5. Adaptive Session Length**
**What to test**: Personalized session recommendations

**Steps**:
1. Go to **Settings > Study tab**
2. **Look for**: "AI suggests: Xmin • Best time: X:XX AM/PM"
3. **Check if**:
   - Session length matches your typical study patterns
   - Optimal time reflects when you usually study
4. Set session to "Custom" and try the AI suggestion

---

## 🔬 Advanced Testing Scenarios

### **Scenario 1: New User Journey**
**Goal**: Test fresh user experience

**Steps**:
1. Create brand new account
2. Import a small deck (10-20 cards)
3. Study for 10 minutes
4. **Expected adaptive behavior**:
   - Milestones: 25 → 75 → 150
   - Celebrations: Every 3 correct answers
   - Fatigue warning: Around 60%
   - Break suggestion: 5-8 minutes
   - Session suggestion: 15-20 minutes

### **Scenario 2: Experienced User Simulation**
**Goal**: Test adaptation to user history

**Method A - Simulate with data**:
```sql
-- Run in Supabase SQL Editor to simulate experienced user
INSERT INTO user_learning_profiles (
    user_id,
    total_cards_studied,
    average_session_length,
    average_retention_rate,
    study_velocity,
    fatigue_threshold,
    celebration_frequency
) VALUES (
    (SELECT auth.uid()),
    450,  -- Lots of cards studied
    35.0, -- Longer sessions
    0.85, -- High retention
    8.5,  -- Fast learner
    72.0, -- Higher fatigue tolerance
    7     -- Less frequent celebrations
);
```

**Method B - Natural simulation**:
1. Study 100+ cards over several sessions
2. Maintain high retention (80%+ good/easy ratings)
3. Take longer study sessions (30+ minutes)
4. **Expected changes**:
   - Milestones become larger
   - Celebrations less frequent
   - Higher fatigue threshold
   - Longer session recommendations

### **Scenario 3: Performance Degradation Test**
**Goal**: Test adaptation to poor performance

**Steps**:
1. Deliberately answer many cards incorrectly (😞/😐)
2. Take very long to answer (10+ seconds per card)
3. Study when fatigued
4. **Expected adaptations**:
   - Lower fatigue threshold
   - More frequent celebrations (encouragement)
   - Shorter break intervals
   - Shorter session recommendations

---

## 🐛 Debugging & Troubleshooting

### **Console Logging**
Enable detailed logging by adding to browser console:
```javascript
localStorage.setItem('debug-personalization', 'true');
```

### **Common Issues**

**1. AI suggestions not appearing**
- Check: User logged in?
- Check: Database migration applied?
- Check: Console errors?

**2. Adaptive features seem static**
- Check: Need more study history (try 10+ cards)
- Check: Profile creation succeeded?
- Run: `localStorage.clear()` and try again

**3. Celebrations not adapting**
- Check: Answer enough cards to trigger celebration
- Check: `personalizedRecommendations` in console
- Verify: Different users get different frequencies

### **Force Refresh Profile**
```javascript
// Run in browser console to force profile recalculation
localStorage.removeItem('personalization-cache');
location.reload();
```

---

## 📊 Success Metrics

### **✅ Basic Functionality**
- [ ] No console errors during initialization
- [ ] AI suggestions appear in Settings
- [ ] Learning insights panel shows data
- [ ] Profile gets created/loaded

### **✅ Adaptation Verification**
- [ ] New users get different recommendations than experienced users
- [ ] Celebration frequency changes based on performance
- [ ] Fatigue thresholds adapt to user patterns
- [ ] Break/session recommendations feel personalized

### **✅ User Experience**
- [ ] Recommendations feel helpful, not intrusive
- [ ] "Use AI suggestion" buttons work
- [ ] Adaptive features don't break existing functionality
- [ ] Performance remains smooth

---

## 🚀 Production Testing Checklist

Before deploying to production:

- [ ] Test with multiple user accounts
- [ ] Verify database permissions/RLS policies
- [ ] Test error handling (network failures, etc.)
- [ ] Check personalization engine performance with large datasets
- [ ] Validate recommendation ranges (no negative values, etc.)
- [ ] Test recommendation updates after study sessions
- [ ] Verify data privacy (users only see their own profiles)

---

## 📈 Long-term Monitoring

Once deployed, monitor:

1. **User engagement**: Do adaptive features increase study session length?
2. **Retention rates**: Do personalized recommendations improve learning outcomes?
3. **Feature usage**: Are users clicking "Use AI suggestion" buttons?
4. **Error rates**: Any issues with profile creation/updates?
5. **Performance**: Database query times for personalization engine

Track with analytics:
```javascript
// Example tracking calls
analytics.track('Adaptive Milestone Reached', { milestone: 150, userType: 'experienced' });
analytics.track('AI Suggestion Used', { feature: 'breakDuration', oldValue: 15, newValue: 12 });
```