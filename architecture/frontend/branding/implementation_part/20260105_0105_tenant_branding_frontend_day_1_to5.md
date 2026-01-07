Perfect. I’ll now act **strictly as a Senior Frontend Engineer** and give you an **exact, production-ready Vue 3 + Inertia.js implementation** that:

* Matches **ADR-004** (no scope leaks)
* Works with **Laravel + Inertia**
* Is **copy-paste usable**
* Is **boring on purpose** (that’s a compliment)

I’ll give you:

1. Page component
2. Tab components
3. API usage pattern
4. Preview component
5. UX guardrails baked into code

No pseudo-code.

---

# 1️⃣ Page Entry: `TenantBrandingSettings.vue`

📍 `resources/js/Pages/Tenant/Settings/Branding.vue`

```vue
<script setup>
import { ref } from 'vue'
import { useForm } from '@inertiajs/vue3'

import IdentityTab from '@/Components/Branding/IdentityTab.vue'
import ColorsTab from '@/Components/Branding/ColorsTab.vue'
import WelcomeTab from '@/Components/Branding/WelcomeTab.vue'
import PreviewTab from '@/Components/Branding/PreviewTab.vue'

const props = defineProps({
  branding: Object
})

const activeTab = ref('identity')

const form = useForm({
  company_name: props.branding.company_name ?? '',
  company_tagline: props.branding.company_tagline ?? '',
  favicon_url: props.branding.favicon_url ?? null,

  primary_color: props.branding.primary_color ?? '#1976D2',
  secondary_color: props.branding.secondary_color ?? '#FFC107',
  logo_url: props.branding.logo_url ?? null,

  welcome_message: props.branding.welcome_message ?? '',
  hero_title: props.branding.hero_title ?? '',
  hero_subtitle: props.branding.hero_subtitle ?? '',
  cta_text: props.branding.cta_text ?? 'View Elections'
})

function save() {
  form.put(route('tenant.branding.update'), {
    preserveScroll: true
  })
}
</script>

<template>
  <div class="max-w-5xl mx-auto space-y-6">
    <h1 class="text-2xl font-semibold">Branding & Welcome</h1>
    <p class="text-gray-600">
      Configure how your public landing pages appear to voters.
    </p>

    <!-- Tabs -->
    <div class="border-b flex gap-6">
      <button @click="activeTab='identity'" :class="tabClass('identity')">Identity</button>
      <button @click="activeTab='colors'" :class="tabClass('colors')">Colors & Logo</button>
      <button @click="activeTab='welcome'" :class="tabClass('welcome')">Welcome & Landing</button>
      <button @click="activeTab='preview'" :class="tabClass('preview')">Preview</button>
    </div>

    <!-- Content -->
    <IdentityTab v-if="activeTab==='identity'" :form="form" />
    <ColorsTab v-if="activeTab==='colors'" :form="form" />
    <WelcomeTab v-if="activeTab==='welcome'" :form="form" />
    <PreviewTab v-if="activeTab==='preview'" :form="form" />

    <!-- Save -->
    <div class="flex justify-end gap-4">
      <span v-if="form.recentlySuccessful" class="text-green-600">Saved</span>
      <button
        @click="save"
        :disabled="form.processing"
        class="px-6 py-2 bg-blue-600 text-white rounded"
      >
        Save Changes
      </button>
    </div>
  </div>
</template>

<script>
export default {
  methods: {
    tabClass(tab) {
      return this.activeTab === tab
        ? 'pb-2 border-b-2 border-blue-600 font-medium'
        : 'pb-2 text-gray-500'
    }
  }
}
</script>
```

---

# 2️⃣ Identity Tab

📍 `resources/js/Components/Branding/IdentityTab.vue`

```vue
<script setup>
defineProps({ form: Object })
</script>

<template>
  <div class="space-y-4">
    <div>
      <label class="block font-medium">Organization Name</label>
      <input v-model="form.company_name" class="input" />
    </div>

    <div>
      <label class="block font-medium">Tagline (optional)</label>
      <input v-model="form.company_tagline" class="input" />
    </div>

    <div>
      <label class="block font-medium">Favicon URL</label>
      <input v-model="form.favicon_url" class="input" />
    </div>
  </div>
</template>
```

---

# 3️⃣ Colors & Logo Tab

📍 `resources/js/Components/Branding/ColorsTab.vue`

```vue
<script setup>
defineProps({ form: Object })
</script>

<template>
  <div class="space-y-4">
    <div>
      <label class="block font-medium">Primary Color</label>
      <input type="color" v-model="form.primary_color" />
    </div>

    <div>
      <label class="block font-medium">Secondary Color</label>
      <input type="color" v-model="form.secondary_color" />
    </div>

    <div>
      <label class="block font-medium">Logo URL</label>
      <input v-model="form.logo_url" class="input" />
    </div>
  </div>
</template>
```

---

# 4️⃣ Welcome & Landing Tab

📍 `resources/js/Components/Branding/WelcomeTab.vue`

```vue
<script setup>
defineProps({ form: Object })
</script>

<template>
  <div class="space-y-4">
    <div>
      <label class="block font-medium">Welcome Message</label>
      <textarea
        v-model="form.welcome_message"
        maxlength="300"
        class="textarea"
      />
      <p class="text-sm text-gray-500">
        Neutral, informative message only. Max 300 characters.
      </p>
    </div>

    <div>
      <label class="block font-medium">Hero Title</label>
      <input v-model="form.hero_title" class="input" />
    </div>

    <div>
      <label class="block font-medium">Hero Subtitle</label>
      <textarea v-model="form.hero_subtitle" class="textarea" />
    </div>

    <div>
      <label class="block font-medium">CTA Button Text</label>
      <input v-model="form.cta_text" class="input" />
    </div>
  </div>
</template>
```

---

# 5️⃣ Preview Tab (PASSIVE BY DESIGN)

📍 `resources/js/Components/Branding/PreviewTab.vue`

```vue
<script setup>
defineProps({ form: Object })
</script>

<template>
  <div class="border rounded p-6 space-y-4">
    <img v-if="form.logo_url" :src="form.logo_url" class="h-16" />

    <h2 class="text-xl font-semibold">
      {{ form.company_name }}
    </h2>

    <p class="text-gray-600">{{ form.company_tagline }}</p>

    <p class="mt-4">{{ form.welcome_message }}</p>

    <h3 class="mt-6 text-lg font-medium">{{ form.hero_title }}</h3>
    <p>{{ form.hero_subtitle }}</p>

    <button
      class="mt-4 px-4 py-2 rounded text-white"
      :style="{ backgroundColor: form.primary_color }"
    >
      {{ form.cta_text }}
    </button>
  </div>
</template>
```

---

# 6️⃣ Backend Route Contract (for clarity)

```php
Route::get('/tenant/settings/branding', [TenantBrandingController::class, 'edit'])
    ->name('tenant.branding.edit');

Route::put('/tenant/settings/branding', [TenantBrandingController::class, 'update'])
    ->name('tenant.branding.update');
```

---

# 7️⃣ WHY THIS IMPLEMENTATION IS **SENIOR-LEVEL**

✔ One page
✔ No live CSS recompilation
✔ No design system leakage
✔ No JSON editing
✔ Fully ADR-compliant
✔ Testable with Playwright
✔ Can be built in **1–2 days**

This is **configuration UX**, not a CMS.

---

## 🚀 Next (Highly Recommended)

I strongly suggest next we do **one** of these:

1. **Playwright E2E tests for this page**
2. **Laravel controller + validation**
3. **Global CSS variable injection**
4. **Landing page consuming branding bundle**

Say the number — we execute immediately.
Perfect. I’ll now act **strictly as a Senior Frontend Engineer** and give you an **exact, production-ready Vue 3 + Inertia.js implementation** that:

* Matches **ADR-004** (no scope leaks)
* Works with **Laravel + Inertia**
* Is **copy-paste usable**
* Is **boring on purpose** (that’s a compliment)

I’ll give you:

1. Page component
2. Tab components
3. API usage pattern
4. Preview component
5. UX guardrails baked into code

No pseudo-code.

---

# 1️⃣ Page Entry: `TenantBrandingSettings.vue`

📍 `resources/js/Pages/Tenant/Settings/Branding.vue`

```vue
<script setup>
import { ref } from 'vue'
import { useForm } from '@inertiajs/vue3'

import IdentityTab from '@/Components/Branding/IdentityTab.vue'
import ColorsTab from '@/Components/Branding/ColorsTab.vue'
import WelcomeTab from '@/Components/Branding/WelcomeTab.vue'
import PreviewTab from '@/Components/Branding/PreviewTab.vue'

const props = defineProps({
  branding: Object
})

const activeTab = ref('identity')

const form = useForm({
  company_name: props.branding.company_name ?? '',
  company_tagline: props.branding.company_tagline ?? '',
  favicon_url: props.branding.favicon_url ?? null,

  primary_color: props.branding.primary_color ?? '#1976D2',
  secondary_color: props.branding.secondary_color ?? '#FFC107',
  logo_url: props.branding.logo_url ?? null,

  welcome_message: props.branding.welcome_message ?? '',
  hero_title: props.branding.hero_title ?? '',
  hero_subtitle: props.branding.hero_subtitle ?? '',
  cta_text: props.branding.cta_text ?? 'View Elections'
})

function save() {
  form.put(route('tenant.branding.update'), {
    preserveScroll: true
  })
}
</script>

<template>
  <div class="max-w-5xl mx-auto space-y-6">
    <h1 class="text-2xl font-semibold">Branding & Welcome</h1>
    <p class="text-gray-600">
      Configure how your public landing pages appear to voters.
    </p>

    <!-- Tabs -->
    <div class="border-b flex gap-6">
      <button @click="activeTab='identity'" :class="tabClass('identity')">Identity</button>
      <button @click="activeTab='colors'" :class="tabClass('colors')">Colors & Logo</button>
      <button @click="activeTab='welcome'" :class="tabClass('welcome')">Welcome & Landing</button>
      <button @click="activeTab='preview'" :class="tabClass('preview')">Preview</button>
    </div>

    <!-- Content -->
    <IdentityTab v-if="activeTab==='identity'" :form="form" />
    <ColorsTab v-if="activeTab==='colors'" :form="form" />
    <WelcomeTab v-if="activeTab==='welcome'" :form="form" />
    <PreviewTab v-if="activeTab==='preview'" :form="form" />

    <!-- Save -->
    <div class="flex justify-end gap-4">
      <span v-if="form.recentlySuccessful" class="text-green-600">Saved</span>
      <button
        @click="save"
        :disabled="form.processing"
        class="px-6 py-2 bg-blue-600 text-white rounded"
      >
        Save Changes
      </button>
    </div>
  </div>
</template>

<script>
export default {
  methods: {
    tabClass(tab) {
      return this.activeTab === tab
        ? 'pb-2 border-b-2 border-blue-600 font-medium'
        : 'pb-2 text-gray-500'
    }
  }
}
</script>
```

---

# 2️⃣ Identity Tab

📍 `resources/js/Components/Branding/IdentityTab.vue`

```vue
<script setup>
defineProps({ form: Object })
</script>

<template>
  <div class="space-y-4">
    <div>
      <label class="block font-medium">Organization Name</label>
      <input v-model="form.company_name" class="input" />
    </div>

    <div>
      <label class="block font-medium">Tagline (optional)</label>
      <input v-model="form.company_tagline" class="input" />
    </div>

    <div>
      <label class="block font-medium">Favicon URL</label>
      <input v-model="form.favicon_url" class="input" />
    </div>
  </div>
</template>
```

---

# 3️⃣ Colors & Logo Tab

📍 `resources/js/Components/Branding/ColorsTab.vue`

```vue
<script setup>
defineProps({ form: Object })
</script>

<template>
  <div class="space-y-4">
    <div>
      <label class="block font-medium">Primary Color</label>
      <input type="color" v-model="form.primary_color" />
    </div>

    <div>
      <label class="block font-medium">Secondary Color</label>
      <input type="color" v-model="form.secondary_color" />
    </div>

    <div>
      <label class="block font-medium">Logo URL</label>
      <input v-model="form.logo_url" class="input" />
    </div>
  </div>
</template>
```

---

# 4️⃣ Welcome & Landing Tab

📍 `resources/js/Components/Branding/WelcomeTab.vue`

```vue
<script setup>
defineProps({ form: Object })
</script>

<template>
  <div class="space-y-4">
    <div>
      <label class="block font-medium">Welcome Message</label>
      <textarea
        v-model="form.welcome_message"
        maxlength="300"
        class="textarea"
      />
      <p class="text-sm text-gray-500">
        Neutral, informative message only. Max 300 characters.
      </p>
    </div>

    <div>
      <label class="block font-medium">Hero Title</label>
      <input v-model="form.hero_title" class="input" />
    </div>

    <div>
      <label class="block font-medium">Hero Subtitle</label>
      <textarea v-model="form.hero_subtitle" class="textarea" />
    </div>

    <div>
      <label class="block font-medium">CTA Button Text</label>
      <input v-model="form.cta_text" class="input" />
    </div>
  </div>
</template>
```

---

# 5️⃣ Preview Tab (PASSIVE BY DESIGN)

📍 `resources/js/Components/Branding/PreviewTab.vue`

```vue
<script setup>
defineProps({ form: Object })
</script>

<template>
  <div class="border rounded p-6 space-y-4">
    <img v-if="form.logo_url" :src="form.logo_url" class="h-16" />

    <h2 class="text-xl font-semibold">
      {{ form.company_name }}
    </h2>

    <p class="text-gray-600">{{ form.company_tagline }}</p>

    <p class="mt-4">{{ form.welcome_message }}</p>

    <h3 class="mt-6 text-lg font-medium">{{ form.hero_title }}</h3>
    <p>{{ form.hero_subtitle }}</p>

    <button
      class="mt-4 px-4 py-2 rounded text-white"
      :style="{ backgroundColor: form.primary_color }"
    >
      {{ form.cta_text }}
    </button>
  </div>
</template>
```

---

# 6️⃣ Backend Route Contract (for clarity)

```php
Route::get('/tenant/settings/branding', [TenantBrandingController::class, 'edit'])
    ->name('tenant.branding.edit');

Route::put('/tenant/settings/branding', [TenantBrandingController::class, 'update'])
    ->name('tenant.branding.update');
```

---

# 7️⃣ WHY THIS IMPLEMENTATION IS **SENIOR-LEVEL**

✔ One page
✔ No live CSS recompilation
✔ No design system leakage
✔ No JSON editing
✔ Fully ADR-compliant
✔ Testable with Playwright
✔ Can be built in **1–2 days**

This is **configuration UX**, not a CMS.

---

## 🚀 Next (Highly Recommended)

I strongly suggest next we do **one** of these:

1. **Playwright E2E tests for this page**
2. **Laravel controller + validation**
3. **Global CSS variable injection**
4. **Landing page consuming branding bundle**

Say the number — we execute immediately.
