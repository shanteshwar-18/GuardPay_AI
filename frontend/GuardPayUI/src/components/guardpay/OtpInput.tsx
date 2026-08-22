/**
 * OtpInput — per-digit code entry for the verification and trusted-contact flows.
 *
 * Controlled: the parent owns `value`, this owns focus. Handles auto-advance,
 * backspace-to-previous, and paste (a multi-character change is distributed
 * across the remaining boxes rather than dropped).
 *
 * The error state is a colour AND a glyph AND the caller's `errorMessage`,
 * never colour alone (§48). The shake is transform-only so it runs on the
 * native driver and never blocks typing (§47).
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Animated,
  StyleSheet,
  StyleProp,
  ViewStyle,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
  Platform,
} from 'react-native';
import { theme } from '../../theme';
import { useFontScale } from './useFontScale';

const DIGITS_ONLY = /[^0-9]/g;
const MIN_LENGTH = 4;
const MAX_LENGTH = 6;

export interface OtpInputProps {
  /** Number of boxes, clamped to 4–6. Default 6. */
  length?: number;
  /** Current code (digits only; anything longer than `length` is ignored). */
  value: string;
  onChange: (next: string) => void;
  /** Fired once when the last box is filled. */
  onComplete?: (code: string) => void;
  /** Paint the error state. Pair it with `errorMessage` so it is not colour-only. */
  error?: boolean;
  /** Already-translated error copy rendered under the boxes. */
  errorMessage?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  /** Already-translated accessible name for the group, e.g. "6 digit code". */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  fontScale?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function OtpInput({
  length = MAX_LENGTH,
  value,
  onChange,
  onComplete,
  error = false,
  errorMessage,
  autoFocus = false,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  fontScale,
  style,
  testID,
}: OtpInputProps) {
  const { sf, scale } = useFontScale(fontScale);

  const count = Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, Math.round(length)));

  const inputs = useRef<Array<TextInput | null>>([]);
  const completedFor = useRef<string | null>(null);
  const shake = useRef(new Animated.Value(0)).current;

  const code = useMemo(() => value.replace(DIGITS_ONLY, '').slice(0, count), [value, count]);

  const chars = useMemo(() => {
    const arr: string[] = new Array(count).fill('');
    for (let i = 0; i < code.length; i += 1) {
      arr[i] = code[i];
    }
    return arr;
  }, [code, count]);

  const focusBox = useCallback((index: number) => {
    const target = inputs.current[Math.min(Math.max(index, 0), count - 1)];
    target?.focus();
  }, [count]);

  const emit = useCallback(
    (next: string) => {
      const clean = next.replace(DIGITS_ONLY, '').slice(0, count);
      onChange(clean);
      return clean;
    },
    [count, onChange],
  );

  // Fire onComplete exactly once per completed code.
  useEffect(() => {
    if (code.length === count) {
      if (completedFor.current !== code) {
        completedFor.current = code;
        onComplete?.(code);
      }
    } else {
      completedFor.current = null;
    }
  }, [code, count, onComplete]);

  // Subtle shake when the error flag flips on.
  useEffect(() => {
    if (!error) return;
    const anim = Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [error, shake]);

  const handleChangeText = useCallback(
    (raw: string, index: number) => {
      if (disabled) return;
      const digits = raw.replace(DIGITS_ONLY, '');

      if (digits.length === 0) {
        // Cleared this box. The code is left-packed, so dropping the character
        // and re-joining is the whole operation.
        const next = chars.slice();
        next[index] = '';
        emit(next.join(''));
        return;
      }

      if (digits.length === 1) {
        const next = chars.slice();
        next[index] = digits;
        emit(next.join(''));
        if (index < count - 1) focusBox(index + 1);
        return;
      }

      // Paste (or a fast second keystroke landing in the same box): spread the
      // digits across this box and the ones after it.
      const head = chars.slice(0, index).join('');
      const merged = emit(head + digits);
      focusBox(merged.length >= count ? count - 1 : merged.length);
    },
    [chars, count, disabled, emit, focusBox],
  );

  const handleKeyPress = useCallback(
    (e: NativeSyntheticEvent<TextInputKeyPressEventData>, index: number) => {
      if (disabled) return;
      if (e.nativeEvent.key !== 'Backspace') return;
      if (chars[index] !== '') return;
      if (index === 0) return;

      const next = chars.slice();
      next[index - 1] = '';
      emit(next.join(''));
      focusBox(index - 1);
    },
    [chars, disabled, emit, focusBox],
  );

  const boxSize = Math.max(
    theme.control.minTouch,
    Math.round(theme.control.inputHeight * (scale > 1 ? 1.15 : 1)),
  );

  const activeIndex = Math.min(code.length, count - 1);
  const groupLabel = accessibilityLabel ?? `${code.length}/${count}`;

  return (
    <View style={style} testID={testID}>
      <Animated.View
        style={[
          styles.row,
          {
            transform: [
              {
                translateX: shake.interpolate({
                  inputRange: [-1, 0, 1],
                  outputRange: [-theme.spacing.sm, 0, theme.spacing.sm],
                }),
              },
            ],
          },
        ]}
        accessible={false}
        accessibilityLabel={groupLabel}
        accessibilityHint={accessibilityHint}
      >
        {chars.map((char, index) => {
          const filled = char !== '';
          const isActive = !disabled && index === activeIndex;

          return (
            <Pressable
              key={index}
              onPress={() => focusBox(index)}
              disabled={disabled}
              // The TextInput inside carries the accessible name and the native
              // edit-field role; the Pressable is only an enlarged hit area.
              accessible={false}
              importantForAccessibility="no"
              style={[
                styles.box,
                {
                  width: boxSize,
                  height: boxSize,
                  borderColor: error
                    ? theme.risk.intercept.main
                    : isActive
                      ? theme.brand.blue
                      : filled
                        ? theme.neutral.borderStrong
                        : theme.neutral.border,
                  backgroundColor: error
                    ? theme.risk.intercept.soft
                    : disabled
                      ? theme.neutral.surfaceAlt
                      : theme.neutral.surface,
                },
                isActive && styles.boxActive,
              ]}
            >
              <TextInput
                ref={(el) => {
                  inputs.current[index] = el;
                }}
                testID={testID ? `${testID}-box-${index}` : undefined}
                value={char}
                onChangeText={(text) => handleChangeText(text, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
                importantForAutofill="yes"
                // Long enough to accept a pasted code; extra digits are spread
                // across the following boxes by handleChangeText.
                maxLength={count}
                autoFocus={autoFocus && index === 0}
                editable={!disabled}
                selectTextOnFocus
                caretHidden={filled}
                allowFontScaling={false}
                accessibilityLabel={`${groupLabel} ${index + 1}`}
                accessibilityHint={index === 0 ? accessibilityHint : undefined}
                style={[
                  styles.input,
                  {
                    fontSize: sf(theme.typography.h2.size),
                    color: error ? theme.risk.intercept.dark : theme.neutral.textPrimary,
                  },
                ]}
              />
            </Pressable>
          );
        })}
      </Animated.View>

      {error && errorMessage ? (
        <View style={styles.errorRow} accessible accessibilityRole="alert" accessibilityLiveRegion="assertive">
          <Text
            allowFontScaling={false}
            style={[styles.errorGlyph, { fontSize: sf(theme.typography.caption.size) }]}
            importantForAccessibility="no"
          >
            {'✕'}
          </Text>
          <Text
            allowFontScaling={false}
            style={[
              styles.errorText,
              {
                fontSize: sf(theme.typography.caption.size),
                lineHeight: sf(theme.typography.caption.lineHeight),
              },
            ]}
          >
            {errorMessage}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  box: {
    borderWidth: 2,
    borderRadius: theme.radius.md,
    marginHorizontal: theme.spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  boxActive: {
    ...theme.elevation.sm,
  },
  input: {
    flex: 1,
    width: '100%',
    textAlign: 'center',
    fontWeight: '700',
    padding: 0,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.md,
  },
  errorGlyph: {
    color: theme.risk.intercept.main,
    fontWeight: '700',
    marginRight: theme.spacing.xs,
  },
  errorText: {
    color: theme.risk.intercept.dark,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default OtpInput;
