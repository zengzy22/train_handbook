'use client';

import type {InputHTMLAttributes} from 'react';

// Keep padding outside the native input: iOS WebKit can mis-size padded dates.
export default function DateField(props:Omit<InputHTMLAttributes<HTMLInputElement>,'type'>){
  return <span className="date-field"><input {...props} type="date"/></span>;
}
