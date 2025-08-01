import debounce from "lodash.debounce";
import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { useLatest } from "react-use";

import { TextInput } from "metabase/ui";

import type { ChartSettingWidgetProps } from "./types";

const ALLOWED_CHARS = new Set([
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  ".",
  "-",
  "e",
]);

// Note: there are more props than these that are provided by the viz settings
// code, we just don't have types for them here.
interface ChartSettingInputProps
  extends Omit<ChartSettingWidgetProps<number>, "onChangeSettings"> {
  options?: {
    isInteger?: boolean;
    isNonNegative?: boolean;
  };
  id?: string;
  placeholder?: string;
  getDefault?: () => string;
  className?: string;
}

export const ChartSettingInputNumeric = ({
  onChange,
  value,
  placeholder,
  options,
  id,
  getDefault,
  className,
}: ChartSettingInputProps) => {
  const [inputValue, setInputValue] = useState<string>(value?.toString() ?? "");
  const defaultValueProps = getDefault ? { defaultValue: getDefault() } : {};

  const handleChangeRef = useLatest((e: ChangeEvent<HTMLInputElement>) => {
    let num = e.target.value !== "" ? Number(e.target.value) : Number.NaN;
    if (options?.isInteger) {
      num = Math.round(num);
    }
    if (options?.isNonNegative && num < 0) {
      num *= -1;
    }

    if (isNaN(num)) {
      onChange(undefined);
    } else {
      onChange(num);
      setInputValue(String(num));
    }
  });
  const handleChangeDebounced = useMemo(() => {
    return debounce((e: ChangeEvent<HTMLInputElement>) => {
      handleChangeRef.current(e);
    }, 400);
  }, [handleChangeRef]);

  useEffect(() => {
    setInputValue(value?.toString() ?? "");
  }, [value]);

  return (
    <TextInput
      id={id}
      {...defaultValueProps}
      placeholder={placeholder}
      type="text"
      error={inputValue && isNaN(Number(inputValue))}
      value={inputValue}
      onChange={(e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.value.split("").every((ch) => ALLOWED_CHARS.has(ch))) {
          setInputValue(e.target.value);
          handleChangeDebounced(e);
        }
      }}
      className={className}
    />
  );
};
