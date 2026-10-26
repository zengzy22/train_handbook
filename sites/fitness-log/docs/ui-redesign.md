# Training workspace

Purpose: record sets quickly and retrieve previous training without promotional copy.

Palette: paper `#F3F5F8`, white `#FFFFFF`, ink `#17283E`, slate `#64748B`, blue `#2859D6`, rule `#DCE3EC`. Dark mode uses the same blue with deeper slate surfaces.

Type: PingFang SC / system sans for Chinese headings and controls; Avenir Next for restrained numeric display; SF Mono for dates, units and technical endpoints. No remote font requirement. Body and controls 13–14px, headings 24px, key numbers 28px.

Compared layouts:

```
A: Sidebar | greeting + stats + records + calendar
B: Top navigation
   Page title                                      Add training
   Week: Mon | Tue | Wed | Thu | Fri | Sat | Sun
   Records and search                    30-day totals
                                         Reusable plans
```

Choose B: the seven date cells are the signature, each opens actual records for that day. Unlike the previous decorative weekly bars, they show exact dates and completion/draft counts. Calendar remains a dedicated view, avoiding duplicate month grids on the homepage. Move summaries to a narrow secondary column so records own the main reading path.

Critique: a generic dashboard would lead with four metrics and a hero. Remove both from the primary path. Use one blue selected-date cell, plain dividers, compact controls and no slogans, repeated privacy notices or English section labels. Functional names replace editorial headlines. MCP implementation details go into a disclosure; connection and export remain visible.

Preserve all CRUD, charts, exports, theme switching and authentication contracts. Verify empty and populated states, small screens, editing and navigation.
