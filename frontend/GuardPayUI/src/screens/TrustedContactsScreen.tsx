/**
 * GuardPay AI — TrustedContactsScreen  ·  product spec §40
 *
 * Manage the people GuardPay calls when a payment is held or blocked.
 *
 * §40: numbers are shown masked — the screen renders `maskPhone()` output and
 *      never the raw number it received.
 * §41: every call is wrapped; a failed load shows a retryable error, a failed
 *      write restores the previous list instead of leaving a phantom row.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import {
  AppHeader,
  Card,
  EmptyState,
  PrimaryButton,
  ScreenContainer,
  SecurityAlert,
  TrustedContactCard,
} from '../components/guardpay';
import { useScaledFont, useSeniorMode } from '../context/SeniorModeContext';
import {
  addTrustedContact,
  ApiError,
  listTrustedContacts,
  maskPhone,
  removeTrustedContact,
} from '../services/api';
import type { TrustedContact } from '../services/api';
import theme from '../theme';
import { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'TrustedContacts'>;

/** Indian mobile numbers, with or without a +91 / 0 prefix. */
const PHONE_PATTERN = /^(?:\+?\d{1,3})?\d{10}$/;

const MAX_NAME_LENGTH = 60;
const MAX_RELATION_LENGTH = 30;

export function TrustedContactsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const sf = useScaledFont();
  const { fontScale } = useSeniorMode();

  const [contacts, setContacts] = useState<TrustedContact[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const offlineMessage = useCallback(
    (err: unknown) =>
      err instanceof ApiError
        ? err.message
        : t('common.offlineBody', {
            defaultValue: 'GuardPay could not reach the server. Please try again.',
          }),
    [t],
  );

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setLoadError(null);
      try {
        // NOTE: this endpoint returns a bare array, not an envelope object.
        const res = await listTrustedContacts();
        setContacts(Array.isArray(res) ? res : []);
      } catch (err) {
        setContacts(null);
        setLoadError(offlineMessage(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [offlineMessage],
  );

  useEffect(() => {
    load('initial');
  }, [load]);

  // ── Add ───────────────────────────────────────────────────────────────────
  const onAdd = useCallback(async () => {
    const cleanName = name.trim();
    const cleanPhone = phone.replace(/[\s()-]/g, '');
    const cleanRelation = relationship.trim();

    if (cleanName.length < 2) {
      setFormError(
        t('settings.invalidContactName', { defaultValue: 'Enter the contact’s name' }),
      );
      return;
    }
    if (!PHONE_PATTERN.test(cleanPhone)) {
      setFormError(
        t('settings.invalidContactPhone', { defaultValue: 'Enter a valid 10-digit mobile number' }),
      );
      return;
    }

    setFormError(null);
    setSaving(true);
    try {
      const created = await addTrustedContact({
        name: cleanName,
        phone_number: cleanPhone,
        relationship: cleanRelation || undefined,
      });
      setContacts(prev => (prev ? prev.concat(created) : [created]));
      setName('');
      setPhone('');
      setRelationship('');
    } catch (err) {
      setFormError(offlineMessage(err));
    } finally {
      setSaving(false);
    }
  }, [name, offlineMessage, phone, relationship, t]);

  // ── Remove ────────────────────────────────────────────────────────────────
  const confirmRemove = useCallback(
    (contact: TrustedContact) => {
      Alert.alert(
        t('settings.removeContact'),
        t('settings.removeContactConfirm', {
          defaultValue:
            'GuardPay will no longer call this person to verify high-risk payments.',
        }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('settings.removeContact'),
            style: 'destructive',
            onPress: async () => {
              const previous = contacts;
              setContacts(prev =>
                prev ? prev.filter(c => c.contact_id !== contact.contact_id) : prev,
              );
              try {
                await removeTrustedContact(contact.contact_id);
              } catch (err) {
                setContacts(previous ?? null); // restore — the delete did not happen
                setLoadError(offlineMessage(err));
              }
            },
          },
        ],
      );
    },
    [contacts, offlineMessage, t],
  );

  const canSave = useMemo(
    () => name.trim().length > 0 && phone.trim().length > 0 && !saving,
    [name, phone, saving],
  );

  // ── Sub-renders ───────────────────────────────────────────────────────────
  const renderList = () => {
    if (loading && !refreshing) {
      return (
        <View style={styles.centre} testID="contacts-loading">
          <ActivityIndicator size="large" color={theme.brand.blue} />
          <Text
            allowFontScaling={false}
            style={[styles.helper, { fontSize: sf(theme.typography.body.size) }]}
          >
            {t('common.loading')}
          </Text>
        </View>
      );
    }

    if (loadError && !contacts) {
      return (
        <SecurityAlert
          testID="contacts-error"
          tone="warning"
          title={t('common.errorTitle', { defaultValue: 'Could not load your trusted contacts' })}
          message={loadError}
          actionLabel={t('common.retry')}
          onActionPress={() => load('refresh')}
          actionAccessibilityHint={t('settings.trustedContacts')}
          fontScale={fontScale}
          style={styles.block}
        />
      );
    }

    if (!contacts || contacts.length === 0) {
      return (
        <EmptyState
          testID="contacts-empty"
          icon="☏"
          title={t('trustedContact.noContact')}
          message={t('trustedContact.noContactBody')}
          compact
          fontScale={fontScale}
          style={styles.block}
        />
      );
    }

    return contacts.map((contact, index) => (
      <TrustedContactCard
        key={contact.contact_id}
        testID={`contact-${contact.contact_id}`}
        name={contact.name}
        relationship={contact.relationship}
        phoneMasked={maskPhone(contact.phone_number)}
        isPrimary={contact.is_primary ?? index === 0}
        primaryLabel={t('payment.trusted')}
        actionLabel={t('settings.removeContact')}
        actionHint={t('settings.removeContactConfirm', {
          defaultValue: 'GuardPay will no longer call this person to verify high-risk payments.',
        })}
        actionDestructive
        onPressAction={() => confirmRemove(contact)}
        fontScale={fontScale}
        style={styles.rowGap}
      />
    ));
  };

  const renderInput = (
    testID: string,
    label: string,
    value: string,
    onChangeText: (next: string) => void,
    extra?: {
      keyboardType?: 'default' | 'phone-pad';
      maxLength?: number;
      autoCapitalize?: 'none' | 'words';
    },
  ) => (
    <View style={styles.field}>
      <Text
        allowFontScaling={false}
        style={[styles.label, { fontSize: sf(theme.typography.caption.size) }]}
      >
        {label}
      </Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={next => {
          onChangeText(next);
          if (formError) setFormError(null);
        }}
        placeholder={label}
        placeholderTextColor={theme.neutral.textMuted}
        keyboardType={extra?.keyboardType ?? 'default'}
        maxLength={extra?.maxLength}
        autoCapitalize={extra?.autoCapitalize ?? 'words'}
        autoCorrect={false}
        allowFontScaling={false}
        accessibilityLabel={label}
        style={[
          styles.input,
          {
            fontSize: sf(theme.typography.body.size),
            minHeight: sf(theme.control.inputHeight),
          },
        ]}
      />
    </View>
  );

  return (
    <ScreenContainer testID="contacts-screen" padded={false}>
      <AppHeader
        testID="contacts-header"
        title={t('settings.trustedContacts')}
        subtitle={t('trustedContact.body')}
        onBack={() => navigation.goBack()}
        backAccessibilityLabel={t('risk.common.back')}
        backAccessibilityHint={t('settings.title')}
        fontScale={fontScale}
        style={styles.header}
      />

      <ScrollView
        testID="contacts-scroll"
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load('refresh')}
            colors={[theme.brand.blue]}
            tintColor={theme.brand.blue}
            accessibilityLabel={t('common.retry')}
          />
        }
      >
        {renderList()}

        {/* ── Add form ─────────────────────────────────────────────────── */}
        <Card testID="contacts-add-form" style={styles.block}>
          <Text
            allowFontScaling={false}
            accessibilityRole="header"
            style={[styles.sectionTitle, { fontSize: sf(theme.typography.h3.size) }]}
          >
            {t('settings.addContact')}
          </Text>

          {renderInput('contacts-name-input', t('settings.contactName'), name, setName, {
            maxLength: MAX_NAME_LENGTH,
          })}
          {renderInput('contacts-phone-input', t('settings.contactPhone'), phone, setPhone, {
            keyboardType: 'phone-pad',
            maxLength: 16,
            autoCapitalize: 'none',
          })}
          {renderInput(
            'contacts-relation-input',
            t('settings.contactRelation'),
            relationship,
            setRelationship,
            { maxLength: MAX_RELATION_LENGTH },
          )}

          {formError ? (
            <Text
              testID="contacts-form-error"
              allowFontScaling={false}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={[styles.error, { fontSize: sf(theme.typography.caption.size) }]}
            >
              ⚠ {formError}
            </Text>
          ) : null}

          <PrimaryButton
            testID="contacts-save"
            label={t('settings.save')}
            onPress={onAdd}
            loading={saving}
            disabled={!canSave}
            accessibilityHint={t('settings.addContact')}
            fontScale={fontScale}
            style={styles.saveButton}
          />
        </Card>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: theme.spacing.xl },
  content: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xxxl,
  },
  block: { marginBottom: theme.spacing.lg },
  rowGap: { marginBottom: theme.spacing.md },
  sectionTitle: {
    color: theme.neutral.textPrimary,
    fontWeight: theme.typography.h3.weight,
    marginBottom: theme.spacing.lg,
  },
  field: { marginBottom: theme.spacing.lg },
  label: {
    color: theme.neutral.textSecondary,
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.neutral.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.neutral.surfaceAlt,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    color: theme.neutral.textPrimary,
  },
  error: {
    color: theme.risk.intercept.dark,
    fontWeight: '600',
    marginBottom: theme.spacing.md,
  },
  saveButton: { marginTop: theme.spacing.xs },
  centre: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.huge,
  },
  helper: { color: theme.neutral.textSecondary, marginTop: theme.spacing.md },
});

export default TrustedContactsScreen;
