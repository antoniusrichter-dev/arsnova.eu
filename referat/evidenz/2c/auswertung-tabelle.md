### Qualität (alle gültigen Läufe, unabhängig von Swap)

| Fall | Variante | Läufe | gültig | OOM-betroffen | Fragen im Kontext | Schema ok | Gate ok | Modellstatus uncertain | entfernte IDs | Prompt-Tok. | Compl.-Tok. |
| ---- | -------- | ----: | -----: | ------------: | ----------------- | --------: | ------: | ---------------------: | ------------: | ----------: | ----------: |
| a-P200 | voll | 5 | 5 | 0 | F E C | 5/5 | 0/5 | 0/5 | 0 | 2005 | 500 |
| a-P200 | nur-texte | 5 | 5 | 0 | B F E | 5/5 | 5/5 | 5/5 | 0 | 1310 | 358 |
| a-P200 | texte-metadaten | 5 | 5 | 0 | B D C | 5/5 | 5/5 | 0/5 | 0 | 1485 | 308 |
| b-P200-lernziel | voll | 5 | 5 | 0 | E F C | 5/5 | 0/5 | 5/5 | 0 | 2141 | 395 |
| b-P200-lernziel | nur-texte | 5 | 5 | 0 | A E C | 5/5 | 5/5 | 0/5 | 0 | 1292 | 300 |
| b-P200-lernziel | texte-metadaten | 5 | 5 | 0 | C D B | 5/5 | 0/5 | 1/5 | 0 | 1464 | 285 |
| c-P50skaliert-lernziel | voll | 5 | 5 | 0 | C E F | 5/5 | 0/5 | 5/5 | 0 | 2162 | 520 |
| c-P50skaliert-lernziel | nur-texte | 5 | 5 | 0 | E B C | 5/5 | 0/5 | 5/5 | 0 | 1305 | 347 |
| c-P50skaliert-lernziel | texte-metadaten | 5 | 5 | 0 | C A D | 5/5 | 0/5 | 0/5 | 0 | 1492 | 291 |
| d-456-teilmenge | voll | 5 | 5 | 0 | 8 Fragen | 5/5 | 0/5 | 5/5 | 0 | 2207 | 391 |
| d-456-teilmenge | nur-texte | 5 | 5 | 0 | 8 Fragen | 5/5 | 0/5 | 4/5 | 0 | 2190 | 455 |
| d-456-teilmenge | texte-metadaten | 5 | 1 | 4 | 8 Fragen | 1/1 | 0/1 | 1/1 | 0 | 2227 | 403 |
| d-456-teilmenge | texte-metadaten (Wdh. nach OOM-Neustart) | 5 | 5 | 0 | 8 Fragen | 5/5 | 0/5 | 5/5 | 0 | 2173 | 391 |

### Zeit und Speicher (getrennt nach Messbedingung)

| Fall | Variante | Messbedingung | n | Prefill kalt (ms, n) | Prompt-Cache-Treffer: Rest-Prefill (ms, n) | Tokens/s | Runtime-Antwort Median (s) | Gesamt Median (s) | Peak RssAnon (MiB) | Peak RssFile (MiB) | Swap max (MiB) |
| ---- | -------- | ------------- | -: | -------------------: | -----------------------------------------: | -------: | -------------------------: | ----------------: | -----------------: | -----------------: | -------------: |
| a-P200 | voll | swapfrei | 5 | 27391 (1) | 82 (4) | 11,2 | 44,6 | 46,3 | 4060 | 2363 | 0 |
| a-P200 | nur-texte | unter Swap gemessen | 5 | 12654 (1) | 77 (4) | 12,6 | 28,7 | 28,7 | 5038 | 2156 | 2720 |
| a-P200 | texte-metadaten | unter Swap gemessen | 5 | 10337 (1) | 75 (4) | 12,4 | 25,2 | 25,2 | 5050 | 2156 | 3202 |
| b-P200-lernziel | voll | swapfrei | 5 | 23540 (1) | 85 (4) | 11,2 | 35,8 | 36,3 | 4777 | 2363 | 0 |
| b-P200-lernziel | nur-texte | unter Swap gemessen | 5 | 11457 (1) | 77 (4) | 12,7 | 23,9 | 23,9 | 5065 | 2158 | 3649 |
| b-P200-lernziel | texte-metadaten | unter Swap gemessen | 5 | 10212 (1) | 76 (4) | 12,4 | 23,3 | 23,3 | 5051 | 2158 | 3660 |
| c-P50skaliert-lernziel | voll | swapfrei | 1 | 24012 (1) | – (0) | 10,9 | 76,2 | 76,5 | 4778 | 2363 | 0 |
| c-P50skaliert-lernziel | voll | unter Swap gemessen | 4 | – (0) | 85 (4) | 11,1 | 47,9 | 49,3 | 5072 | 2359 | 1496 |
| c-P50skaliert-lernziel | nur-texte | unter Swap gemessen | 5 | 10998 (1) | 75 (4) | 12,8 | 27,5 | 27,5 | 5062 | 2158 | 4080 |
| c-P50skaliert-lernziel | texte-metadaten | unter Swap gemessen | 5 | 10311 (1) | 74 (4) | 12,6 | 23,5 | 23,5 | 5058 | 2156 | 4592 |
| d-456-teilmenge | voll | unter Swap gemessen | 5 | 25017 (1) | 87 (4) | 11,1 | 36,9 | 38,3 | 5074 | 2163 | 2224 |
| d-456-teilmenge | nur-texte | unter Swap gemessen | 5 | 24128 (1) | 83 (4) | 11,2 | 40,9 | 40,9 | 5063 | 2155 | 4961 |
| d-456-teilmenge | texte-metadaten | unter Swap gemessen | 1 | 24347 (1) | – (0) | 11,2 | 60,3 | 60,3 | 5061 | 2155 | 4843 |
| d-456-teilmenge | texte-metadaten (Wdh. nach OOM-Neustart) | swapfrei | 5 | 32139 (1) | 103 (4) | 9,1 | 42,8 | 42,8 | 3783 | 2373 | 0 |
