# 🔍 Login Debug Guide

## The spinning wheel issue is likely caused by:

### **1. Missing `user_preferences` table**
The UserContext is trying to load from `user_preferences` table which might not exist.

**Quick Fix**: Update UserContext to handle missing table gracefully.

### **2. Network/Database Issues**
Check browser console (F12) for:
- Network errors
- Supabase connection issues
- Missing table errors

### **3. Immediate Solutions**

#### **Option A: Quick Fix (Temporary)**
Add this to browser console while on login page:
```javascript
localStorage.setItem('skip-preferences', 'true');
location.reload();
```

#### **Option B: Create Missing Table**
Run this in Supabase SQL Editor:
```sql
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own preferences" ON user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences" ON user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences" ON user_preferences
  FOR UPDATE USING (auth.uid() = user_id);
```

#### **Option C: Bypass Preferences (Fastest)**
I can update the UserContext to not load preferences on login.

### **4. Check These in Browser Console:**
1. Open F12 → Console tab
2. Try to login
3. Look for errors like:
   - "relation 'user_preferences' does not exist"
   - Network timeout errors
   - Authentication errors

### **5. Test Database Connection:**
```javascript
// Run in browser console
import { supabase } from './src/lib/supabaseClient.js';
supabase.from('user_learning_profiles').select('*').limit(1).then(console.log);
```

## Which solution would you prefer?
1. **Quick bypass** - I'll update code to skip preferences loading
2. **Full fix** - Create the missing user_preferences table
3. **Debug first** - Check console errors and report back