import type { StackId } from './design-export';

/**
 * Конструкторы форм и таблиц (docs/16-design-system.md, «Конструкторы»):
 * по описанию полей или колонок отдают заготовку компонента выбранного стека
 * на токенах дизайна и **заготовку словаря на каждый язык проекта** — как у
 * дизайн-систем, где форма собирается за минуты и сразу двуязычная. Чистые
 * функции над строками; файлы в проект приложение не пишет (ADR-0022).
 */

export type FieldType = 'text' | 'email' | 'password' | 'number' | 'textarea' | 'select' | 'checkbox';

export const FIELD_TYPES: readonly FieldType[] = ['text', 'email', 'password', 'number', 'textarea', 'select', 'checkbox'];

export interface FormSpec {
  name: string;
  fields: { id: string; type: FieldType; required: boolean }[];
}

export interface TableSpec {
  name: string;
  columns: { id: string; sortable: boolean }[];
}

export interface Generated {
  files: { path: string; content: string }[];
  /** Язык → вложенный словарь: ключи для кода и пустые значения для перевода. */
  dictionaries: Record<string, Record<string, unknown>>;
}

const IDENTIFIER = /^[a-z][A-Za-z0-9]*$/;

/** Что мешает построить: пусто — можно. Имена попадают в код, поэтому только безопасные. */
export function constructorProblems(name: string, ids: readonly string[]): string[] {
  const problems: string[] = [];
  if (!IDENTIFIER.test(name)) problems.push('name');
  if (ids.length === 0) problems.push('empty');
  for (const id of ids) {
    if (!IDENTIFIER.test(id)) problems.push(`id:${id}`);
  }
  if (new Set(ids).size !== ids.length) problems.push('duplicate');
  return problems;
}

const pascal = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const snake = (value: string) => value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

/** `firstName` → `First name`: стартовая подсказка для английского, остальные языки остаются пустыми. */
function humanize(id: string): string {
  const words = id.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return pascal(words);
}

function dictionaryOf(entries: Record<string, unknown>, locales: readonly string[]): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  const fill = (node: unknown, locale: string): unknown => {
    if (typeof node === 'string') return locale === 'en' ? node : '';
    if (node !== null && typeof node === 'object') {
      return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, fill(value, locale)]));
    }
    return node;
  };
  for (const locale of locales) out[locale] = fill(entries, locale) as Record<string, unknown>;
  return out;
}

/** Вложенный словарь → плоские пары `a.b.c` → значение. */
function flat(node: Record<string, unknown>, prefix = ''): [string, string][] {
  return Object.entries(node).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? [[path, value] as [string, string]] : flat(value as Record<string, unknown>, path);
  });
}

const xmlEscape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/'/g, "\\'");

function dictionaryFiles(stack: StackId, name: string, dictionaries: Record<string, Record<string, unknown>>): Generated['files'] {
  const files: Generated['files'] = [];
  for (const [locale, dictionary] of Object.entries(dictionaries)) {
    switch (stack) {
      case 'nuxt-ui':
        files.push({ path: `i18n/locales/${locale}/${name}.json`, content: `${JSON.stringify(dictionary, null, 2)}\n` });
        break;
      case 'expo':
        files.push({ path: `locales/${locale}/${name}.json`, content: `${JSON.stringify(dictionary, null, 2)}\n` });
        break;
      case 'compose':
        files.push({
          path: `app/src/main/res/values${locale === 'en' ? '' : `-${locale}`}/strings_${snake(name)}.xml`,
          content: ['<?xml version="1.0" encoding="utf-8"?>', '<resources>',
            ...flat(dictionary).map(([key, value]) => `    <string name="${key.replace(/\./g, '_')}">${xmlEscape(value)}</string>`),
            '</resources>', ''].join('\n')
        });
        break;
      case 'swiftui':
        files.push({
          path: `${locale}.lproj/${pascal(name)}.strings`,
          content: `${flat(dictionary).map(([key, value]) => `"${key}" = "${value.replace(/"/g, '\\"')}";`).join('\n')}\n`
        });
        break;
    }
  }
  return files;
}

/* ---------- формы ---------- */

export function generateForm(stack: StackId, spec: FormSpec, locales: readonly string[]): Generated {
  const { name, fields } = spec;
  const entries: Record<string, unknown> = {
    [name]: {
      title: humanize(name),
      fields: Object.fromEntries(fields.map((field) => [field.id, humanize(field.id)])),
      actions: { submit: 'Save', cancel: 'Cancel' },
      errors: { required: 'This field is required' }
    }
  };
  const dictionaries = dictionaryOf(entries, locales);
  const key = (suffix: string) => `${name}.${suffix}`;
  const component = `${pascal(name)}Form`;

  const files: Generated['files'] = [];
  switch (stack) {
    case 'nuxt-ui': {
      const initial = fields.map((field) => `  ${field.id}: ${field.type === 'checkbox' ? 'false' : field.type === 'number' ? 'undefined' : "''"}`).join(',\n');
      const required = fields.filter((field) => field.required)
        .map((field) => `  if (!values.${field.id}) errors.push({ name: '${field.id}', message: t('${key('errors.required')}') });`);
      const control = (field: FormSpec['fields'][number]) => {
        switch (field.type) {
          case 'textarea': return `<UTextarea v-model="state.${field.id}" class="w-full" />`;
          case 'select': return `<USelect v-model="state.${field.id}" :items="[]" class="w-full" />`;
          case 'checkbox': return `<UCheckbox v-model="state.${field.id}" />`;
          default: return `<UInput v-model="state.${field.id}" type="${field.type}" class="w-full" />`;
        }
      };
      files.push({
        path: `app/components/${component}.vue`,
        content: [
          '<script setup lang="ts">',
          "import type { FormError } from '@nuxt/ui';",
          '',
          'const { t } = useI18n();',
          "const emit = defineEmits<{ submit: [values: typeof state]; cancel: [] }>();",
          '',
          'const state = reactive({',
          initial,
          '});',
          '',
          'function validate(values: typeof state): FormError[] {',
          '  const errors: FormError[] = [];',
          ...required,
          '  return errors;',
          '}',
          '</script>',
          '',
          '<template>',
          `  <UForm :state="state" :validate="validate" class="space-y-4" @submit="emit('submit', state)">`,
          ...fields.flatMap((field) => [
            `    <UFormField :label="t('${key(`fields.${field.id}`)}')" name="${field.id}"${field.required ? ' required' : ''}>`,
            `      ${control(field)}`,
            '    </UFormField>'
          ]),
          '    <div class="flex gap-2">',
          `      <UButton type="submit">{{ t('${key('actions.submit')}') }}</UButton>`,
          `      <UButton variant="outline" color="neutral" @click="emit('cancel')">{{ t('${key('actions.cancel')}') }}</UButton>`,
          '    </div>',
          '  </UForm>',
          '</template>',
          ''
        ].join('\n')
      });
      break;
    }
    case 'expo':
      files.push({
        path: `components/${component}.tsx`,
        content: [
          "import { useState } from 'react';",
          "import { Pressable, Switch, Text, TextInput, View } from 'react-native';",
          "import { useTranslation } from 'react-i18next';",
          "import { radius, spacing, typography, useThemeColors } from '@/constants/theme';",
          '',
          `export function ${component}({ onSubmit, onCancel }: { onSubmit: (values: Record<string, unknown>) => void; onCancel: () => void }) {`,
          '  const { t } = useTranslation();',
          '  const colors = useThemeColors();',
          '  const [values, setValues] = useState<Record<string, unknown>>({});',
          '  const [errors, setErrors] = useState<Record<string, string>>({});',
          '',
          '  function submit() {',
          '    const next: Record<string, string> = {};',
          ...fields.filter((field) => field.required).map((field) => `    if (!values.${field.id}) next.${field.id} = t('${key('errors.required')}');`),
          '    setErrors(next);',
          '    if (Object.keys(next).length === 0) onSubmit(values);',
          '  }',
          '',
          '  return (',
          '    <View style={{ gap: spacing.md }}>',
          ...fields.flatMap((field) => [
            '      <View>',
            `        <Text style={{ color: colors.ink, fontSize: typography.small.fontSize }}>{t('${key(`fields.${field.id}`)}')}</Text>`,
            field.type === 'checkbox'
              ? `        <Switch value={Boolean(values.${field.id})} onValueChange={(value) => setValues({ ...values, ${field.id}: value })} />`
              : `        <TextInput value={String(values.${field.id} ?? '')} onChangeText={(value) => setValues({ ...values, ${field.id}: value })}${field.type === 'password' ? ' secureTextEntry' : ''}${field.type === 'email' ? " keyboardType=\"email-address\"" : ''}${field.type === 'number' ? " keyboardType=\"numeric\"" : ''}${field.type === 'textarea' ? ' multiline' : ''} style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: spacing.md, color: colors.ink, minHeight: 44 }} />`,
            `        {errors.${field.id} ? <Text style={{ color: colors.danger }}>{errors.${field.id}}</Text> : null}`,
            '      </View>'
          ]),
          '      <View style={{ flexDirection: \'row\', gap: spacing.sm }}>',
          `        <Pressable onPress={submit} style={{ backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, minHeight: 44, justifyContent: 'center' }}>`,
          `          <Text style={{ color: colors.onAccent }}>{t('${key('actions.submit')}')}</Text>`,
          '        </Pressable>',
          `        <Pressable onPress={onCancel} style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, minHeight: 44, justifyContent: 'center' }}>`,
          `          <Text style={{ color: colors.ink }}>{t('${key('actions.cancel')}')}</Text>`,
          '        </Pressable>',
          '      </View>',
          '    </View>',
          '  );',
          '}',
          ''
        ].join('\n')
      });
      break;
    case 'compose':
      files.push({
        path: `${component}.kt`,
        content: [
          'import androidx.compose.foundation.layout.Arrangement',
          'import androidx.compose.foundation.layout.Column',
          'import androidx.compose.foundation.layout.Row',
          'import androidx.compose.material3.Button',
          'import androidx.compose.material3.OutlinedButton',
          'import androidx.compose.material3.OutlinedTextField',
          'import androidx.compose.material3.Text',
          'import androidx.compose.runtime.Composable',
          'import androidx.compose.runtime.getValue',
          'import androidx.compose.runtime.mutableStateOf',
          'import androidx.compose.runtime.remember',
          'import androidx.compose.runtime.setValue',
          'import androidx.compose.ui.res.stringResource',
          '',
          '@Composable',
          `fun ${component}(onSubmit: () -> Unit, onCancel: () -> Unit) {`,
          ...fields.map((field) => `    var ${field.id} by remember { mutableStateOf("") }`),
          '    Column(verticalArrangement = Arrangement.spacedBy(AppSpacing.md)) {',
          ...fields.flatMap((field) => [
            '        OutlinedTextField(',
            `            value = ${field.id},`,
            `            onValueChange = { ${field.id} = it },`,
            `            label = { Text(stringResource(R.string.${key(`fields.${field.id}`).replace(/\./g, '_')})) },`,
            '        )'
          ]),
          '        Row(horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm)) {',
          `            Button(onClick = onSubmit) { Text(stringResource(R.string.${key('actions.submit').replace(/\./g, '_')})) }`,
          `            OutlinedButton(onClick = onCancel) { Text(stringResource(R.string.${key('actions.cancel').replace(/\./g, '_')})) }`,
          '        }',
          '    }',
          '}',
          ''
        ].join('\n')
      });
      break;
    case 'swiftui':
      files.push({
        path: `${component}.swift`,
        content: [
          'import SwiftUI',
          '',
          `struct ${component}: View {`,
          ...fields.map((field) => `    @State private var ${field.id} = ${field.type === 'checkbox' ? 'false' : '""'}`),
          '    var onSubmit: () -> Void',
          '    var onCancel: () -> Void',
          '',
          '    var body: some View {',
          '        Form {',
          ...fields.map((field) => field.type === 'checkbox'
            ? `            Toggle(NSLocalizedString("${key(`fields.${field.id}`)}", tableName: "${pascal(name)}", comment: ""), isOn: $${field.id})`
            : `            ${field.type === 'password' ? 'Secure' : 'Text'}Field(NSLocalizedString("${key(`fields.${field.id}`)}", tableName: "${pascal(name)}", comment: ""), text: $${field.id})`),
          '            HStack(spacing: AppTheme.Spacing.sm) {',
          `                Button(NSLocalizedString("${key('actions.submit')}", tableName: "${pascal(name)}", comment: ""), action: onSubmit)`,
          `                Button(NSLocalizedString("${key('actions.cancel')}", tableName: "${pascal(name)}", comment: ""), role: .cancel, action: onCancel)`,
          '            }',
          '        }',
          '    }',
          '}',
          ''
        ].join('\n')
      });
      break;
  }

  return { files: [...files, ...dictionaryFiles(stack, name, dictionaries)], dictionaries };
}

/* ---------- таблицы ---------- */

export function generateTable(stack: StackId, spec: TableSpec, locales: readonly string[]): Generated {
  const { name, columns } = spec;
  const entries: Record<string, unknown> = {
    [name]: {
      title: humanize(name),
      columns: Object.fromEntries(columns.map((column) => [column.id, humanize(column.id)])),
      empty: 'Nothing here yet'
    }
  };
  const dictionaries = dictionaryOf(entries, locales);
  const key = (suffix: string) => `${name}.${suffix}`;
  const component = `${pascal(name)}Table`;

  const files: Generated['files'] = [];
  switch (stack) {
    case 'nuxt-ui':
      files.push({
        path: `app/components/${component}.vue`,
        content: [
          '<script setup lang="ts">',
          "import type { TableColumn } from '@nuxt/ui';",
          '',
          'const { t } = useI18n();',
          'defineProps<{ rows: Record<string, unknown>[] }>();',
          '',
          'const columns = computed<TableColumn<Record<string, unknown>>[]>(() => [',
          ...columns.map((column) => `  { accessorKey: '${column.id}', header: t('${key(`columns.${column.id}`)}') },`),
          ']);',
          '</script>',
          '',
          '<template>',
          '  <div class="overflow-x-auto">',
          '    <UTable :data="rows" :columns="columns" />',
          `    <p v-if="!rows.length" class="p-4 text-sm text-muted">{{ t('${key('empty')}') }}</p>`,
          '  </div>',
          '</template>',
          ''
        ].join('\n')
      });
      break;
    case 'expo':
      files.push({
        path: `components/${component}.tsx`,
        content: [
          "import { FlatList, Text, View } from 'react-native';",
          "import { useTranslation } from 'react-i18next';",
          "import { spacing, typography, useThemeColors } from '@/constants/theme';",
          '',
          `export function ${component}({ rows }: { rows: Record<string, unknown>[] }) {`,
          '  const { t } = useTranslation();',
          '  const colors = useThemeColors();',
          '  return (',
          '    <FlatList',
          '      data={rows}',
          `      ListHeaderComponent={<View style={{ flexDirection: 'row', gap: spacing.md }}>${columns.map((column) => `<Text style={{ flex: 1, color: colors.muted, fontSize: typography.caption.fontSize }}>{t('${key(`columns.${column.id}`)}')}</Text>`).join('')}</View>}`,
          `      ListEmptyComponent={<Text style={{ color: colors.muted }}>{t('${key('empty')}')}</Text>}`,
          `      renderItem={({ item }) => <View style={{ flexDirection: 'row', gap: spacing.md }}>${columns.map((column) => `<Text style={{ flex: 1, color: colors.ink }}>{String(item.${column.id} ?? '')}</Text>`).join('')}</View>}`,
          '    />',
          '  );',
          '}',
          ''
        ].join('\n')
      });
      break;
    case 'compose':
      files.push({
        path: `${component}.kt`,
        content: [
          'import androidx.compose.foundation.layout.Row',
          'import androidx.compose.foundation.lazy.LazyColumn',
          'import androidx.compose.foundation.lazy.items',
          'import androidx.compose.material3.Text',
          'import androidx.compose.runtime.Composable',
          'import androidx.compose.ui.res.stringResource',
          '',
          '@Composable',
          `fun ${component}(rows: List<Map<String, String>>) {`,
          '    LazyColumn {',
          '        item {',
          '            Row {',
          ...columns.map((column) => `                Text(stringResource(R.string.${key(`columns.${column.id}`).replace(/\./g, '_')}))`),
          '            }',
          '        }',
          '        if (rows.isEmpty()) {',
          `            item { Text(stringResource(R.string.${key('empty').replace(/\./g, '_')})) }`,
          '        }',
          '        items(rows) { row ->',
          '            Row {',
          ...columns.map((column) => `                Text(row["${column.id}"] ?: "")`),
          '            }',
          '        }',
          '    }',
          '}',
          ''
        ].join('\n')
      });
      break;
    case 'swiftui':
      files.push({
        path: `${component}.swift`,
        content: [
          'import SwiftUI',
          '',
          `struct ${component}: View {`,
          '    let rows: [[String: String]]',
          '',
          '    var body: some View {',
          '        if rows.isEmpty {',
          `            Text(NSLocalizedString("${key('empty')}", tableName: "${pascal(name)}", comment: ""))`,
          '        } else {',
          '            List(rows.indices, id: \\.self) { index in',
          '                HStack {',
          ...columns.map((column) => `                    Text(rows[index]["${column.id}"] ?? "")`),
          '                }',
          '            }',
          '        }',
          '    }',
          '}',
          ''
        ].join('\n')
      });
      break;
  }

  return { files: [...files, ...dictionaryFiles(stack, name, dictionaries)], dictionaries };
}
