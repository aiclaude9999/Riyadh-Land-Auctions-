# Simulated user testing — Riyadh Meetup Point (22 Nov 2026)

8 test users from Saudi Arabia and the wider Middle East. These are **simulated people**, not real
customers: each one's task was actually run in the app (browser automation on the free-data version,
phone or laptop, Arabic or English), and what they "say" is written from what really happened.
Confirm the findings with a few real friends before big changes.

## The testers

| # | Tester | Background | Device · language | Task |
|---|---|---|---|---|
| 1 | **Noura** (28, Saudi) | Marketing specialist, Al Malqa; organises her friends' coffee meetups | iPhone · Arabic | 4 friends (3 by car, 1 by metro), café, now |
| 2 | **Abdullah** (45, Saudi) | Father of four, Al Suwaidi; weekend dinner with his brother and uncle | Android · Arabic | 3 families by car, restaurant, needs a family section and parking |
| 3 | **Faisal** (21, Saudi) | King Saud University student, no car | Android · English | Meet a friend in Al Malaz by metro, Sunday 16:30 |
| 4 | **Ahmed** (34, Egyptian) | Accountant living near Al Batha, no car, careful with money | Android · English | Meet a cousin in Al Aziziyah by metro, cheap place |
| 5 | **Lina** (31, Lebanese) | Manager in Olaya | Laptop · English | Dinner with a friend, both love Italian; wants ratings and booking |
| 6 | **Khalid** (60, Saudi) | Retired teacher, not used to apps | iPhone · Arabic | First look: can he understand what to do? |
| 7 | **Mariam** (26, Emirati) | Weekend visitor, hotel next to Kingdom Centre, doesn't know Riyadh's districts | iPhone · English | Set her starting point |
| 8 | **Yousef** (38, Jordanian) | Engineer, Al Sahafah; Ramadan suhoor with 4 friends after Taraweeh | Laptop · English | 5 people (3 car, 2 metro, one by taxi to the station), Ramadan mode, 23:30 |

## What happened and what they said

**1. Noura — worked well.** 4 people in **20 taps**, results in **3.9 s**. Winner: Wooden Coffee,
longest trip 24 min, "no line change" for the metro user, everyone shown with "leave at" times.
> «الأعمدة الملونة ممتازة، أشوف بسرعة إن المشوار عادل. بس أبغى أرسل النتيجة بالواتساب مع وقت انطلاق كل وحدة.»
> *"The coloured bars are great — I see at once it's fair. But I want to send the result on WhatsApp with each girl's leave time."*

**2. Abdullah — missing what matters to families.** Search worked (3 people, 15 taps, 2.9 s; winner Chinese Palace, 33 min).
No way to ask for a **family section** or **parking**, and the winner's name was in English only.
> «الأهم عندي قسم عوائل ومواقف. وبعض أسماء المطاعم بالإنجليزي فقط.»
> *"What matters most to me is a family section and parking. Some restaurant names are only in English."*

**3. Faisal — got stuck changing his location; long walk.** After choosing a neighbourhood he wanted to
change it, but the search box had disappeared — **only "Clear" brings it back**. Result: both 46 min,
Faisal walks **25 min** to the first station (the app warned him).
> "I picked the wrong area and couldn't find how to change it. Also 25 minutes walking in Riyadh — I'd take the bus. Can it use Riyadh buses?"

**4. Ahmed — his area doesn't exist in the list.** **"Al Batha" was not found** (it is a famous area but not an
official Saudi Post district; the same for "Hittin"). He used Al Dhubbat instead. Result fine
(Coffee Address, 31 min, no line change). **No price information or budget filter.**
> "Everybody knows Al Batha! I almost gave up. And I need to know if a place is cheap."

**5. Lina — Best match is excellent; no ratings or booking.** "Best match" picked **La Casa Pasta, fits 2 of 2, 14 min**.
No star ratings on the card and no reservation option.
> "The taste matching is the best part. But I won't go somewhere without seeing ratings, and I want to book a table."

**6. Khalid — readable, but crowded and small buttons.** Smallest text 13 px ✓, but **28 of 31 buttons are
shorter than 40 px** (phones recommend ~44). The first screen shows the sharing box before the people,
and many controls at once.
> «الخط واضح، لكن الأزرار صغيرة على أصابعي، وما عرفت من وين أبدأ.»
> *"The text is clear, but the buttons are small for my fingers, and I didn't know where to start."*

**7. Mariam — could not set her location.** "Four Seasons Kingdom Centre", "Kingdom Centre", "Boulevard",
"Riyadh Park": **all not found** (only district names work without the Google key). **No "use my location" button.**
Only "Olaya" worked, after guessing.
> "I'm a visitor — I know my hotel and the malls, not district names. Just use my phone's location."

**8. Yousef — the app crashed (fixed).** With Ramadan mode, 23:30, and Omar going **by taxi to the metro**,
the results screen **crashed**: the planner produced a "trip" where Omar drove to the station next to the
restaurant, waited and walked out without riding. **Fixed the same day** (a metro trip now needs at least
one ride; screens guarded; new test). After the fix: Meat Moot, 35 min, Omar = taxi 14 → Green → Blue → walk 4.
No information on whether places are **open late for suhoor**.
> "Ramadan mode is a great idea. For suhoor the first question is: is it open at midnight?"

## Fixes, most important first

| Priority | Problem | Who | Proposed fix | Free? |
|---|---|---|---|---|
| ✅ Done | Crash: taxi-to-station trips without a ride | Yousef | Fixed + test | ✓ |
| 🔴 High | Can't change a starting point without "Clear" | Faisal | Show "Change" next to the location; reopen the search in place | ✓ |
| 🔴 High | Famous areas, malls and hotels not found; no "my location" | Ahmed, Mariam | Add **"📍 Use my location"**; add area aliases (Al Batha, Hittin…) and **landmarks** (malls, hotels, universities) from the venue/OSM data to the search | ✓ |
| 🟠 Medium | Buttons too small | Khalid | Minimum 44 px tap height; bigger mode switches | ✓ |
| 🟠 Medium | Busy first screen | Khalid | People first; sharing box after the first search or collapsed; one-line "how it works" | ✓ |
| 🟠 Medium | Send the result to the group | Noura | **"Send on WhatsApp"**: place, map link and each person's leave time | ✓ |
| 🟠 Medium | Open late? / opening hours | Yousef | Hours for big chains (Starbucks, Dunkin, Kudu, Al Baik…), "open late" filter, "hours unknown" label | ✓ (partly) |
| 🟡 Later | Family section, parking, price | Abdullah, Ahmed | No free data. Options: let users tag places (👍 family section / parking / price ﷼–﷼﷼﷼) and show the tags; or Google data | users / Google |
| 🟡 Later | Ratings and booking | Lina | "Reviews on Google Maps" link exists; ratings inside the app need the Google key; booking link when a website exists | Google |
| 🟡 Later | Riyadh buses | Faisal | Add bus routes if official open data exists | check |
| 🟡 Later | English-only place names | Abdullah | Prefer Arabic names in Arabic mode where any source has one (already done when known) | ✓ |

**What testers liked most:** fairness bars (Noura), taste matching / Best match (Lina), Ramadan mode (Yousef),
"no line change" metro badge (Ahmed), clear Arabic text (Khalid). Searches took about **3–4 seconds**.
