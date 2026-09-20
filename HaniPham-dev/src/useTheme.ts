import {useEffect,useState} from 'react';
export type Theme='beige'|'night';
export function readTheme():Theme {try{return localStorage.getItem('hani-theme')==='beige'?'beige':'night'}catch{return 'night'}}
export function useTheme(){const [theme,setTheme]=useState<Theme>(readTheme);useEffect(()=>{document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme==='night'?'dark':'light';document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='night'?'#211d19':'#f7eee2');try{localStorage.setItem('hani-theme',theme)}catch{}},[theme]);return {theme,toggleTheme:()=>setTheme(t=>t==='night'?'beige':'night')}}
