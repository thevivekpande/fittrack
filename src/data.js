export const LEVELS = [
  { id: 'beginner', label: 'Beginner', description: 'Build your foundation · 3 training days' },
  { id: 'medium', label: 'Medium', description: 'Find your rhythm · 5 training days' },
  { id: 'experienced', label: 'Experienced', description: 'Challenge your limits · 6 training days' },
];

export const TRAINING_PLACES = [
  { id: 'home', label: 'At home', description: 'Bodyweight workouts · No gym equipment' },
  { id: 'gym', label: 'At the gym', description: 'Weights, machines & more exercise options' },
];

export const MUSCLE_GROUPS = ['Biceps', 'Triceps', 'Chest', 'Shoulders', 'Back', 'Legs', 'Core', 'Cardio', 'Mobility'];

const photos = {
  strength: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=900&q=85',
  dumbbells: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=900&q=85',
  training: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=85',
  weights: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=900&q=85',
  cardio: 'https://images.unsplash.com/photo-1538805060514-97d9cc17730c?auto=format&fit=crop&w=900&q=85',
};

export const EXERCISES = [
  {
    id: 'bodyweight-squat', name: 'Bodyweight squat', group: 'Legs', equipment: 'Bodyweight', duration: 5, calories: 30, movement: 'squat', image: photos.training,
    instructions: ['Stand with your feet about shoulder-width apart.', 'Sit your hips back and bend your knees through a comfortable range.', 'Press through your feet to stand, keeping your chest lifted.'],
  },
  {
    id: 'push-up', name: 'Push-up', group: 'Chest', equipment: 'Bodyweight', duration: 5, calories: 32, movement: 'pushup', image: photos.training,
    instructions: ['Place your hands slightly wider than your shoulders.', 'Keep your body in one line as you lower your chest toward the floor.', 'Press back up with control; lower your knees for a gentler variation.'],
  },
  {
    id: 'bicep-curl', name: 'Dumbbell bicep curl', group: 'Biceps', equipment: 'Dumbbells', duration: 5, calories: 25, movement: 'curl', image: photos.dumbbells,
    instructions: ['Stand tall with a dumbbell in each hand and your palms facing forward.', 'Bend your elbows to lift the weights without swinging your torso.', 'Lower slowly and keep your elbows close to your sides.'],
  },
  {
    id: 'shoulder-press', name: 'Dumbbell shoulder press', group: 'Shoulders', equipment: 'Dumbbells', duration: 6, calories: 35, movement: 'press', image: photos.weights,
    instructions: ['Start with dumbbells at shoulder height and your feet planted.', 'Press the weights upward while keeping your ribs stacked over your hips.', 'Lower back to shoulder height slowly and use a comfortable range.'],
  },
  {
    id: 'reverse-lunge', name: 'Reverse lunge', group: 'Legs', equipment: 'Bodyweight', duration: 6, calories: 38, movement: 'lunge', image: photos.training,
    instructions: ['Stand tall, then take a controlled step backward with one foot.', 'Bend both knees, keeping your front foot planted and your torso upright.', 'Push through the front foot to return, then alternate sides.'],
  },
  {
    id: 'plank', name: 'Forearm plank', group: 'Core', equipment: 'Exercise mat', duration: 4, calories: 18, movement: 'plank', image: photos.training,
    instructions: ['Place your forearms on the floor with your elbows below your shoulders.', 'Extend your legs and hold a straight line from head to heels.', 'Breathe steadily; use short, controlled holds and rest when your form changes.'],
  },
  {
    id: 'dumbbell-row', name: 'Bent-over dumbbell row', group: 'Back', equipment: 'Dumbbells', duration: 6, calories: 36, movement: 'row', image: photos.strength,
    instructions: ['Soften your knees and hinge at your hips with your back in a comfortable neutral position.', 'Pull the dumbbells toward your hips while keeping your shoulders away from your ears.', 'Lower with control and keep your torso steady.'],
  },
  {
    id: 'jumping-jack', name: 'Jumping jacks', group: 'Cardio', equipment: 'Bodyweight', duration: 4, calories: 35, movement: 'jumpingjack', image: photos.cardio,
    instructions: ['Begin with your feet together and arms by your sides.', 'Step or jump your feet apart as you raise your arms overhead.', 'Return to the starting position and repeat at a comfortable pace.'],
  },
  {
    id: 'goblet-squat', name: 'Goblet squat', group: 'Legs', equipment: 'Dumbbell', duration: 6, calories: 40, movement: 'squat', image: photos.weights,
    instructions: ['Hold one dumbbell close to your chest with both hands.', 'Bend your knees and sit your hips down through a comfortable range.', 'Keep the weight close and press through your feet to stand.'],
  },
  {
    id: 'incline-push-up', name: 'Incline push-up', group: 'Chest', equipment: 'Stable household support', duration: 5, calories: 25, movement: 'pushup', image: photos.strength,
    instructions: ['Place your hands on a secure counter or other stable raised surface.', 'Step back into a straight-body position and lower your chest toward the surface.', 'Press away with control; a higher surface makes the movement gentler.'],
  },
  {
    id: 'hammer-curl', name: 'Hammer curl', group: 'Biceps', equipment: 'Dumbbells', duration: 5, calories: 26, movement: 'curl', image: photos.dumbbells,
    instructions: ['Hold dumbbells at your sides with your palms facing inward.', 'Curl the weights toward your shoulders while keeping your wrists steady.', 'Lower slowly without moving your upper arms forward.'],
  },
  {
    id: 'walking-lunge', name: 'Dumbbell walking lunge', group: 'Legs', equipment: 'Dumbbells', duration: 6, calories: 42, movement: 'lunge', image: photos.weights,
    instructions: ['Hold a light dumbbell at each side and stand with space ahead of you.', 'Step forward and bend both knees with your front foot firmly planted.', 'Push through the front foot and step into the next lunge, alternating legs.'],
  },
  {
    id: 'standing-reach', name: 'Gentle standing reach', group: 'Mobility', equipment: 'Bodyweight', duration: 3, calories: 8, movement: 'press', image: photos.cardio,
    instructions: ['Stand comfortably with your feet hip-width apart and your shoulders relaxed.', 'Slowly reach both arms upward only as far as feels comfortable.', 'Lower your arms, breathe naturally, and repeat without weights.'],
  },
  {
    id: 'easy-squat', name: 'Easy bodyweight squat', group: 'Mobility', equipment: 'Bodyweight', duration: 3, calories: 12, movement: 'squat', image: photos.training,
    instructions: ['Stand with your feet shoulder-width apart, near a stable support if helpful.', 'Gently bend your knees and move your hips back through a small, comfortable range.', 'Return to standing slowly, keeping the movement easy and unhurried.'],
  },
  {
    id: 'bench-press', name: 'Dumbbell bench press', group: 'Chest', equipment: 'Dumbbells + bench', duration: 6, calories: 34, movement: 'benchpress', image: photos.weights,
    instructions: ['Lie on a flat bench with your feet planted and dumbbells beside your chest.', 'Press the weights upward over your chest with your wrists stacked over your elbows.', 'Lower slowly, keeping your upper arms in a comfortable range.'],
  },
  {
    id: 'lat-pulldown', name: 'Lat pulldown', group: 'Back', equipment: 'Cable machine', duration: 6, calories: 32, movement: 'latpulldown', image: photos.strength,
    instructions: ['Sit with your thighs under the pads and hold the overhead bar comfortably.', 'Draw the bar toward your upper chest while keeping your torso mostly upright.', 'Allow your arms to extend overhead slowly without letting the weight pull you upward.'],
  },
  {
    id: 'cable-row', name: 'Seated cable row', group: 'Back', equipment: 'Cable machine', duration: 6, calories: 33, movement: 'cablerow', image: photos.strength,
    instructions: ['Sit tall with your feet supported and your knees slightly bent.', 'Pull the handle toward your lower ribs, drawing your elbows behind you.', 'Extend your arms with control while keeping your torso steady.'],
  },
  {
    id: 'leg-press', name: 'Leg press', group: 'Legs', equipment: 'Leg press machine', duration: 7, calories: 42, movement: 'legpress', image: photos.strength,
    instructions: ['Sit against the back pad and place your feet shoulder-width apart on the platform.', 'Lower the platform through a comfortable range while keeping your hips supported.', 'Press the platform away without locking your knees; use the machine safety catches.'],
  },
  {
    id: 'lateral-raise', name: 'Dumbbell lateral raise', group: 'Shoulders', equipment: 'Dumbbells', duration: 5, calories: 23, movement: 'lateralraise', image: photos.dumbbells,
    instructions: ['Stand tall with light dumbbells at your sides and a soft bend in your elbows.', 'Raise your arms out to the sides up to a comfortable shoulder-height position.', 'Lower slowly while keeping your shoulders relaxed and your torso still.'],
  },
  {
    id: 'triceps-pushdown', name: 'Cable triceps pushdown', group: 'Triceps', equipment: 'Cable machine', duration: 5, calories: 24, movement: 'tricepspushdown', image: photos.strength,
    instructions: ['Face a high cable pulley and hold the bar with your elbows by your sides.', 'Extend your elbows to press the handle toward your thighs.', 'Return the handle slowly while keeping your upper arms still.'],
  },
  {
    id: 'romanian-deadlift', name: 'Dumbbell Romanian deadlift', group: 'Legs', equipment: 'Dumbbells', duration: 7, calories: 40, movement: 'deadlift', image: photos.weights,
    instructions: ['Stand with dumbbells in front of your thighs and keep a soft bend in your knees.', 'Move your hips backward, lowering the weights close to your legs as your torso tips forward.', 'Stop at a comfortable hamstring stretch, then bring your hips forward to stand.'],
  },
  {
    id: 'glute-bridge', name: 'Glute bridge', group: 'Legs', equipment: 'Exercise mat', duration: 5, calories: 22, movement: 'bridge', image: photos.training,
    instructions: ['Lie on your back with your knees bent and your feet flat on the floor.', 'Press through your feet to lift your hips until your torso and thighs form a gentle line.', 'Lower with control, keeping your ribs relaxed instead of arching your lower back.'],
  },
  {
    id: 'split-squat', name: 'Bodyweight split squat', group: 'Legs', equipment: 'Bodyweight', duration: 5, calories: 29, movement: 'lunge', image: photos.training,
    instructions: ['Stand in a comfortable split stance with one foot in front of the other.', 'Bend both knees to lower straight down while keeping your front foot planted.', 'Rise without moving your feet, finish your repetitions, then switch sides.'],
  },
  {
    id: 'dumbbell-split-squat', name: 'Dumbbell split squat', group: 'Legs', equipment: 'Dumbbells', duration: 6, calories: 36, movement: 'lunge', image: photos.weights,
    instructions: ['Hold dumbbells by your sides and settle into a stable split stance.', 'Bend both knees to lower straight down through a comfortable range.', 'Press through your front foot to rise, finish the set, then switch sides.'],
  },
  {
    id: 'dumbbell-reverse-lunge', name: 'Dumbbell reverse lunge', group: 'Legs', equipment: 'Dumbbells', duration: 6, calories: 39, movement: 'lunge', image: photos.weights,
    instructions: ['Stand tall with dumbbells by your sides and leave clear space behind you.', 'Step one foot backward and bend both knees while keeping your front foot planted.', 'Push through the front foot to return to standing, then alternate sides.'],
  },
  {
    id: 'sumo-squat', name: 'Bodyweight sumo squat', group: 'Legs', equipment: 'Bodyweight', duration: 5, calories: 29, movement: 'squat', image: photos.training,
    instructions: ['Take a comfortably wide stance with your toes turned slightly outward.', 'Bend your knees in the same direction as your toes and lower your hips.', 'Keep your feet planted and stand up without forcing a deeper range.'],
  },
  {
    id: 'dumbbell-sumo-squat', name: 'Dumbbell sumo squat', group: 'Legs', equipment: 'Dumbbell', duration: 6, calories: 36, movement: 'squat', image: photos.weights,
    instructions: ['Stand comfortably wide with your toes slightly out and a dumbbell held close to your chest.', 'Bend your knees in line with your toes and lower your hips through a comfortable range.', 'Press through your feet to stand while keeping the weight close.'],
  },
  {
    id: 'wide-push-up', name: 'Wide push-up', group: 'Chest', equipment: 'Bodyweight', duration: 5, calories: 30, movement: 'pushup', image: photos.training,
    instructions: ['Place your hands a little wider than for your usual push-up, within a comfortable range.', 'Keep your body in one line and lower your chest between your hands.', 'Press up with control; use your knees if you need a gentler variation.'],
  },
  {
    id: 'narrow-push-up', name: 'Narrow push-up', group: 'Triceps', equipment: 'Bodyweight', duration: 5, calories: 30, movement: 'pushup', image: photos.training,
    instructions: ['Place your hands under your shoulders and begin in a straight-body position.', 'Bend your elbows close to your sides as you lower your chest.', 'Press back up slowly; lower your knees if needed to keep good control.'],
  },
  {
    id: 'forward-lunge', name: 'Forward lunge', group: 'Legs', equipment: 'Bodyweight', duration: 5, calories: 31, movement: 'lunge', image: photos.training,
    instructions: ['Stand tall and take a controlled step forward with one foot.', 'Bend both knees while keeping your front foot planted and your chest upright.', 'Press through the front foot to step back, then alternate sides.'],
  },
  {
    id: 'chest-fly', name: 'Dumbbell chest fly', group: 'Chest', equipment: 'Dumbbells + bench', duration: 6, calories: 28, movement: 'chestfly', image: photos.weights,
    instructions: ['Lie on a flat bench with light dumbbells above your chest and a soft bend in your elbows.', 'Open your arms in a wide arc, stopping within a comfortable shoulder range.', 'Bring the weights together over your chest without changing the bend in your elbows.'],
  },
  {
    id: 'incline-bench-press', name: 'Incline dumbbell bench press', group: 'Chest', equipment: 'Dumbbells + incline bench', duration: 6, calories: 34, movement: 'benchpress', image: photos.weights,
    instructions: ['Set a bench to a gentle incline, sit back, and hold dumbbells beside your upper chest.', 'Press the weights upward while keeping your feet planted and your back supported.', 'Lower slowly until your upper arms reach a comfortable depth.'],
  },
  {
    id: 'front-raise', name: 'Dumbbell front raise', group: 'Shoulders', equipment: 'Dumbbells', duration: 5, calories: 22, movement: 'frontraise', image: photos.dumbbells,
    instructions: ['Stand tall with light dumbbells in front of your thighs.', 'Raise your arms forward to a comfortable shoulder-height position with a slight elbow bend.', 'Lower with control and keep your torso still instead of swinging the weights.'],
  },
  {
    id: 'overhead-triceps-extension', name: 'Overhead triceps extension', group: 'Triceps', equipment: 'Dumbbell', duration: 5, calories: 24, movement: 'tricepsextension', image: photos.weights,
    instructions: ['Hold one light dumbbell with both hands above your head and keep your upper arms close to your ears.', 'Bend your elbows to lower the weight behind your head through a comfortable range.', 'Straighten your elbows to raise the weight while keeping your upper arms steady.'],
  },
  {
    id: 'leg-extension', name: 'Seated leg extension', group: 'Legs', equipment: 'Leg extension machine', duration: 6, calories: 29, movement: 'legextension', image: photos.strength,
    instructions: ['Adjust the seat so your knees line up with the machine pivot and the roller rests above your ankles.', 'Extend your knees to lift the roller, keeping your hips and back against the pads.', 'Lower the roller slowly without letting the weight stack slam.'],
  },
  {
    id: 'seated-leg-curl', name: 'Seated leg curl', group: 'Legs', equipment: 'Leg curl machine', duration: 6, calories: 29, movement: 'legcurl', image: photos.strength,
    instructions: ['Adjust the seat and thigh pad, with the lower roller behind your ankles.', 'Bend your knees to pull the roller down and back while keeping your torso supported.', 'Return slowly toward the starting position without lifting your hips.'],
  },
  {
    id: 'dumbbell-calf-raise', name: 'Dumbbell calf raise', group: 'Legs', equipment: 'Dumbbells', duration: 5, calories: 24, movement: 'calfraise', image: photos.weights,
    instructions: ['Stand with dumbbells by your sides and your feet hip-width apart.', 'Rise onto the balls of your feet, keeping your knees softly extended.', 'Lower your heels slowly to the floor and pause before the next repetition.'],
  },
  {
    id: 'alternating-bicep-curl', name: 'Alternating dumbbell curl', group: 'Biceps', equipment: 'Dumbbells', duration: 5, calories: 25, movement: 'curl', image: photos.dumbbells,
    instructions: ['Stand tall with dumbbells at your sides and your palms facing forward.', 'Curl one weight toward your shoulder while keeping the opposite arm relaxed.', 'Lower that weight fully, then curl with the other arm without swinging your torso.'],
  },
  {
    id: 'reverse-curl', name: 'Dumbbell reverse curl', group: 'Biceps', equipment: 'Dumbbells', duration: 5, calories: 24, movement: 'curl', image: photos.dumbbells,
    instructions: ['Hold light dumbbells in front of your thighs with your palms facing backward.', 'Bend your elbows to raise the weights while keeping your palms facing downward.', 'Lower slowly and keep your wrists in line with your forearms.'],
  },
  {
    id: 'cable-bicep-curl', name: 'Cable bicep curl', group: 'Biceps', equipment: 'Cable machine', duration: 5, calories: 25, movement: 'curl', image: photos.strength,
    instructions: ['Face a low cable pulley and hold the bar with your palms facing upward.', 'Curl the bar toward your shoulders while keeping your elbows close to your sides.', 'Lower the bar with control without leaning backward.'],
  },
  {
    id: 'single-arm-dumbbell-row', name: 'Single-arm dumbbell row', group: 'Back', equipment: 'Dumbbell', duration: 6, calories: 32, movement: 'row', image: photos.weights,
    instructions: ['Take a staggered stance, hinge at your hips, and rest your free hand on your front thigh.', 'Pull the dumbbell toward your hip while keeping your torso steady.', 'Lower the weight with control, complete your repetitions, then switch sides.'],
  },
  {
    id: 'seated-shoulder-press', name: 'Seated dumbbell shoulder press', group: 'Shoulders', equipment: 'Dumbbells + bench', duration: 6, calories: 30, movement: 'press', image: photos.weights,
    instructions: ['Sit on an upright bench with your feet planted and dumbbells at shoulder height.', 'Press the weights overhead while keeping your back supported and your ribs relaxed.', 'Lower slowly to shoulder height through a comfortable range.'],
  },
  {
    id: 'crunch', name: 'Abdominal crunch', group: 'Core', equipment: 'Exercise mat', duration: 4, calories: 18, movement: 'crunch', image: photos.training,
    instructions: ['Lie on your back with your knees bent, feet flat, and arms crossed loosely over your chest.', 'Exhale and lift your shoulder blades a small distance from the mat, keeping your neck relaxed.', 'Lower slowly without sitting all the way up or pulling on your head.'],
  },
  {
    id: 'reverse-crunch', name: 'Reverse crunch', group: 'Core', equipment: 'Exercise mat', duration: 4, calories: 19, movement: 'reversecrunch', image: photos.training,
    instructions: ['Lie on your back with your hips and knees bent and your arms resting beside you.', 'Draw your knees toward your chest and gently curl your pelvis a small distance off the mat.', 'Lower your hips with control instead of swinging your legs to create momentum.'],
  },
  {
    id: 'dead-bug', name: 'Dead bug', group: 'Core', equipment: 'Exercise mat', duration: 5, calories: 20, movement: 'deadbug', image: photos.training,
    instructions: ['Lie on your back with your arms pointing upward and your hips and knees bent to about right angles.', 'Slowly extend one leg and the opposite arm, using a range that lets your lower back stay comfortably supported.', 'Return both limbs to the starting position, then repeat on the other side.'],
  },
  {
    id: 'bicycle-crunch', name: 'Bicycle crunch', group: 'Core', equipment: 'Exercise mat', duration: 5, calories: 25, movement: 'bicyclecrunch', image: photos.training,
    instructions: ['Lie on your back, lift your shoulder blades slightly, and rest your fingertips lightly beside your head.', 'Rotate one shoulder toward the opposite bent knee as the other leg extends.', 'Alternate sides slowly, turning through your torso without pulling on your neck.'],
  },
  {
    id: 'heel-tap', name: 'Alternating heel taps', group: 'Core', equipment: 'Exercise mat', duration: 4, calories: 18, movement: 'heeltap', image: photos.training,
    instructions: ['Lie on your back with knees bent, feet flat and close to your hips, and arms beside you.', 'Lift your shoulder blades slightly and bend sideways to reach one hand toward the heel on the same side.', 'Alternate sides with short, controlled reaches while keeping your feet planted.'],
  },
  {
    id: 'mountain-climber', name: 'Mountain climber', group: 'Core', equipment: 'Bodyweight', duration: 5, calories: 32, movement: 'mountainclimber', image: photos.cardio,
    instructions: ['Start in a high plank with your hands beneath your shoulders and your body in a steady line.', 'Draw one knee forward beneath your torso while the other leg stays extended.', 'Return that foot and alternate legs at a controlled pace, keeping your hips steady.'],
  },
  {
    id: 'cable-crunch', name: 'Kneeling cable crunch', group: 'Core', equipment: 'Cable machine', duration: 5, calories: 24, movement: 'cablecrunch', image: photos.strength,
    instructions: ['Kneel facing a high cable pulley and hold the rope ends beside your head with a light resistance.', 'Keep your hips mostly still and curl your upper torso forward, bringing your ribs toward your pelvis.', 'Return slowly while keeping the rope near your head instead of pulling it down with your arms.'],
  },
  {
    id: 'knee-push-up', name: 'Knee push-up', group: 'Chest', equipment: 'Exercise mat', duration: 5, calories: 23, movement: 'pushup', image: photos.training,
    instructions: ['Place your hands slightly wider than your shoulders and rest your knees on a mat.', 'Keep a straight line from your shoulders to your knees as you lower your chest.', 'Press back up with control, keeping your hips in line with your torso.'],
  },
  {
    id: 'wall-push-up', name: 'Wall push-up', group: 'Chest', equipment: 'Stable household support', duration: 4, calories: 15, movement: 'pushup', image: photos.training,
    instructions: ['Stand facing a wall and place your palms on it at about shoulder height.', 'Step back a comfortable distance, then bend your elbows to move your chest toward the wall.', 'Press away while keeping your body in a straight line and both feet planted.'],
  },
  {
    id: 'chair-squat', name: 'Chair squat', group: 'Legs', equipment: 'Stable household support', duration: 5, calories: 24, movement: 'squat', image: photos.training,
    instructions: ['Stand in front of a sturdy chair that cannot slide, with your feet about shoulder-width apart.', 'Move your hips back and bend your knees until you gently touch the seat.', 'Press through your feet to stand without dropping onto the chair or using momentum.'],
  },
  {
    id: 'standing-calf-raise', name: 'Standing calf raise', group: 'Legs', equipment: 'Bodyweight', duration: 4, calories: 17, movement: 'calfraise', image: photos.training,
    instructions: ['Stand tall with your feet about hip-width apart, close to a stable support if needed for balance.', 'Rise onto the balls of your feet while keeping your knees softly extended.', 'Lower your heels slowly to the floor and pause before the next repetition.'],
  },
  {
    id: 'single-leg-glute-bridge', name: 'Single-leg glute bridge', group: 'Legs', equipment: 'Exercise mat', duration: 5, calories: 25, movement: 'bridge', image: photos.training,
    instructions: ['Lie on your back with one foot planted, and lift the other leg while keeping your hips level.', 'Press through the planted foot to lift your hips through a comfortable range.', 'Lower slowly, finish the repetitions, and switch sides without twisting your pelvis.'],
  },
  {
    id: 'bird-dog', name: 'Bird dog', group: 'Core', equipment: 'Exercise mat', duration: 5, calories: 20, movement: 'birddog', image: photos.training,
    instructions: ['Start on your hands and knees with your hands under your shoulders and knees under your hips.', 'Reach one arm forward and the opposite leg backward while keeping your torso steady.', 'Return both limbs to the floor, then switch sides without arching your lower back.'],
  },
  {
    id: 'side-plank', name: 'Side plank', group: 'Core', equipment: 'Exercise mat', duration: 4, calories: 20, movement: 'sideplank', image: photos.training,
    instructions: ['Lie on one side with your elbow directly beneath your shoulder and your legs extended.', 'Lift your hips to form a steady line through your torso and legs, keeping your neck relaxed.', 'Breathe steadily during a short controlled hold, then lower and switch sides.'],
  },
  {
    id: 'lying-leg-raise', name: 'Lying leg raise', group: 'Core', equipment: 'Exercise mat', duration: 5, calories: 23, movement: 'legraise', image: photos.training,
    instructions: ['Lie on your back with your arms by your sides and your legs extended upward with soft knees.', 'Lower your legs slowly only as far as you can keep your lower back comfortably supported.', 'Raise your legs with control; bend your knees or shorten the range if needed.'],
  },
  {
    id: 'superman', name: 'Superman', group: 'Back', equipment: 'Exercise mat', duration: 4, calories: 18, movement: 'superman', image: photos.training,
    instructions: ['Lie face down with your arms reaching forward and your legs extended comfortably.', 'Gently lift your arms and legs a small distance while keeping your gaze toward the mat.', 'Lower with control and avoid forcing your back into a deep arch.'],
  },
  {
    id: 'incline-plank', name: 'Elevated forearm plank', group: 'Core', equipment: 'Stable household support', duration: 4, calories: 16, movement: 'plank', image: photos.training,
    instructions: ['Rest your forearms on a secure raised surface with your elbows below your shoulders.', 'Step your feet back and hold a straight line from your shoulders to your heels.', 'Breathe steadily and end the hold before your hips sag or your shoulders tense.'],
  },
  {
    id: 'barbell-bench-press', name: 'Barbell bench press', group: 'Chest', equipment: 'Barbell + bench', duration: 6, calories: 35, movement: 'benchpress', image: photos.weights,
    instructions: ['Lie on a bench with your feet planted and take an even grip on the bar; use appropriate rack safeties or a spotter.', 'Lower the bar toward your chest with your wrists stacked over your elbows.', 'Press upward with control, keeping your shoulders supported on the bench.'],
  },
  {
    id: 'barbell-back-squat', name: 'Barbell back squat', group: 'Legs', equipment: 'Barbell', duration: 7, calories: 42, movement: 'squat', image: photos.weights,
    instructions: ['Set the rack safeties, position the bar across your upper back, and stand with a comfortable stance.', 'Brace your torso and bend your hips and knees through a controlled, comfortable range.', 'Press through your feet to stand while keeping the bar balanced over your stance.'],
  },
  {
    id: 'dumbbell-hip-thrust', name: 'Dumbbell hip thrust', group: 'Legs', equipment: 'Dumbbell + bench', duration: 6, calories: 29, movement: 'bridge', image: photos.weights,
    instructions: ['Rest your upper back against a stable bench and hold a padded dumbbell securely across your hips.', 'Plant your feet and raise your hips until your torso is roughly level, keeping your ribs relaxed.', 'Lower with control without letting the weight roll or arching your lower back.'],
  },
  {
    id: 'neutral-grip-lat-pulldown', name: 'Neutral-grip lat pulldown', group: 'Back', equipment: 'Cable machine', duration: 6, calories: 32, movement: 'latpulldown', image: photos.strength,
    instructions: ['Sit with your thighs supported and hold the parallel handles with your palms facing each other.', 'Pull the handles toward your upper chest while keeping your torso steady.', 'Let your arms extend upward slowly without shrugging or leaning far backward.'],
  },
  {
    id: 'wide-grip-cable-row', name: 'Wide-grip seated cable row', group: 'Back', equipment: 'Cable machine', duration: 6, calories: 33, movement: 'cablerow', image: photos.strength,
    instructions: ['Sit tall with your feet supported and hold a wide cable handle with an even grip.', 'Draw the handle toward your lower chest, keeping your elbows comfortably out from your sides.', 'Extend your arms slowly while keeping your torso still instead of rocking with the weight.'],
  },
  {
    id: 'seated-hammer-curl', name: 'Seated hammer curl', group: 'Biceps', equipment: 'Dumbbells + bench', duration: 5, calories: 25, movement: 'curl', image: photos.dumbbells,
    instructions: ['Sit upright with your feet planted and dumbbells at your sides, palms facing inward.', 'Bend your elbows to curl the weights while keeping your upper arms still.', 'Lower slowly without swinging your torso or bending your wrists.'],
  },
  {
    id: 'rope-triceps-pushdown', name: 'Rope triceps pushdown', group: 'Triceps', equipment: 'Cable machine', duration: 5, calories: 24, movement: 'tricepspushdown', image: photos.strength,
    instructions: ['Face a high cable pulley and hold the rope ends with your elbows close to your sides.', 'Extend your elbows and gently separate the rope ends near your thighs.', 'Return the rope with control while keeping your shoulders and upper arms steady.'],
  },
  {
    id: 'cable-face-pull', name: 'Cable face pull', group: 'Shoulders', equipment: 'Cable machine', duration: 5, calories: 23, movement: 'facepull', image: photos.strength,
    instructions: ['Set the cable near face height and hold the rope ends with a comfortable stance.', 'Pull the rope toward your face, separating your hands and keeping your elbows comfortably raised.', 'Extend your arms slowly without shrugging your shoulders or leaning backward.'],
  },
].map((exercise) => ({
  ...exercise,
  places: /dumbbell|barbell|machine/i.test(exercise.equipment) ? ['gym'] : ['home', 'gym'],
  ...(exercise.group === 'Core' ? { aliases: ['abs', 'abdominals', 'core'] } : {}),
}));

export function getExercisesForPlace(place = 'gym') {
  const selectedPlace = place === 'home' ? 'home' : 'gym';
  return EXERCISES.filter((exercise) => exercise.places.includes(selectedPlace));
}

const planDay = (day, title, focus, duration, exerciseIds, sets, reps, rest = false) => ({ day, title, focus, duration, exerciseIds, rest, sets, reps });
const recovery = (day, title = 'Active recovery') => planDay(day, title, 'Gentle movement & mobility', 10, ['standing-reach', 'easy-squat'], 1, '6', true);

const gymPlans = {
  beginner: [
    planDay('Mon', 'Gym foundations', 'Full body · Strength', 30, ['goblet-squat', 'bench-press', 'lat-pulldown', 'plank'], 2, '8–10'),
    recovery('Tue'),
    planDay('Wed', 'Build your strength', 'Upper body · Strength', 30, ['bench-press', 'cable-row', 'bicep-curl', 'lateral-raise'], 2, '8–10'),
    recovery('Thu', 'Move & recharge'),
    planDay('Fri', 'Strong from the ground up', 'Lower body · Core', 30, ['leg-press', 'reverse-lunge', 'glute-bridge', 'plank'], 2, '8–10'),
    recovery('Sat', 'Weekend movement'),
    recovery('Sun', 'Rest & reset'),
  ],
  medium: [
    planDay('Mon', 'Upper body strength', 'Chest, shoulders & arms', 45, ['bench-press', 'shoulder-press', 'lat-pulldown', 'triceps-pushdown', 'plank'], 3, '10–12'),
    planDay('Tue', 'Lower body power', 'Legs & glutes', 45, ['leg-press', 'romanian-deadlift', 'walking-lunge', 'glute-bridge', 'plank'], 3, '10–12'),
    planDay('Wed', 'Core & conditioning', 'Core · Cardio', 30, ['jumping-jack', 'plank', 'bodyweight-squat', 'reverse-lunge'], 3, '12–15'),
    recovery('Thu'),
    planDay('Fri', 'Pull day', 'Back & biceps', 40, ['lat-pulldown', 'cable-row', 'bicep-curl', 'hammer-curl'], 3, '10–12'),
    planDay('Sat', 'Full body energy', 'Full body · Strength', 45, ['goblet-squat', 'bench-press', 'lateral-raise', 'dumbbell-row', 'walking-lunge'], 3, '10–12'),
    recovery('Sun', 'Rest & reset'),
  ],
  experienced: [
    planDay('Mon', 'Push your potential', 'Chest, shoulders & triceps', 55, ['bench-press', 'shoulder-press', 'lateral-raise', 'triceps-pushdown', 'narrow-push-up'], 4, '8–12'),
    planDay('Tue', 'Pull with purpose', 'Back & biceps', 55, ['lat-pulldown', 'cable-row', 'dumbbell-row', 'bicep-curl', 'hammer-curl'], 4, '8–12'),
    planDay('Wed', 'Leg day, elevated', 'Legs & glutes', 60, ['leg-press', 'romanian-deadlift', 'dumbbell-split-squat', 'dumbbell-sumo-squat'], 4, '10–12'),
    planDay('Thu', 'Upper body volume', 'Upper body · Strength', 55, ['bench-press', 'cable-row', 'shoulder-press', 'lateral-raise', 'triceps-pushdown'], 4, '10–12'),
    planDay('Fri', 'Lower body strength', 'Lower body · Core', 55, ['goblet-squat', 'romanian-deadlift', 'dumbbell-reverse-lunge', 'plank'], 4, '10–12'),
    planDay('Sat', 'Athletic conditioning', 'Full body · Conditioning', 40, ['jumping-jack', 'push-up', 'bodyweight-squat', 'dumbbell-row', 'plank'], 4, '12–15'),
    recovery('Sun', 'Rest & reset'),
  ],
};

const homePlans = {
  beginner: [
    planDay('Mon', 'Home foundations', 'Full body · Bodyweight', 25, ['bodyweight-squat', 'incline-push-up', 'glute-bridge', 'plank'], 2, '8–10'),
    recovery('Tue'),
    planDay('Wed', 'Find your balance', 'Legs & core · Bodyweight', 25, ['split-squat', 'glute-bridge', 'plank', 'standing-reach'], 2, '8–10'),
    recovery('Thu', 'Move & recharge'),
    planDay('Fri', 'Feel-good full body', 'Full body · Bodyweight', 25, ['sumo-squat', 'incline-push-up', 'reverse-lunge', 'glute-bridge'], 2, '8–10'),
    recovery('Sat', 'Weekend movement'),
    recovery('Sun', 'Rest & reset'),
  ],
  medium: [
    planDay('Mon', 'Home strength circuit', 'Full body · Bodyweight', 35, ['push-up', 'bodyweight-squat', 'reverse-lunge', 'glute-bridge', 'plank'], 3, '10–12'),
    planDay('Tue', 'Lower body control', 'Legs & glutes · Bodyweight', 35, ['sumo-squat', 'split-squat', 'forward-lunge', 'glute-bridge'], 3, '10–12'),
    planDay('Wed', 'Core & cardio at home', 'Core · Cardio', 30, ['jumping-jack', 'plank', 'bodyweight-squat', 'reverse-lunge'], 3, '12–15'),
    recovery('Thu'),
    planDay('Fri', 'Push & stabilize', 'Upper body & core', 30, ['push-up', 'narrow-push-up', 'incline-push-up', 'plank'], 3, '10–12'),
    planDay('Sat', 'Weekend bodyweight flow', 'Full body · Conditioning', 35, ['sumo-squat', 'wide-push-up', 'forward-lunge', 'glute-bridge', 'jumping-jack'], 3, '10–12'),
    recovery('Sun', 'Rest & reset'),
  ],
  experienced: [
    planDay('Mon', 'Push-up progression', 'Chest, arms & core', 40, ['wide-push-up', 'narrow-push-up', 'push-up', 'plank'], 4, '12–15'),
    planDay('Tue', 'Unilateral leg strength', 'Legs & balance', 40, ['split-squat', 'forward-lunge', 'reverse-lunge', 'glute-bridge'], 4, '12–15'),
    planDay('Wed', 'Bodyweight engine', 'Full body · Conditioning', 35, ['jumping-jack', 'push-up', 'bodyweight-squat', 'plank'], 4, '12–15'),
    planDay('Thu', 'Upper body endurance', 'Chest, arms & core', 40, ['narrow-push-up', 'wide-push-up', 'incline-push-up', 'plank'], 4, '12–15'),
    planDay('Fri', 'Legs with intention', 'Legs & glutes', 40, ['sumo-squat', 'split-squat', 'reverse-lunge', 'glute-bridge'], 4, '12–15'),
    planDay('Sat', 'Full body finisher', 'Full body · Conditioning', 40, ['push-up', 'forward-lunge', 'bodyweight-squat', 'jumping-jack', 'plank'], 4, '12–15'),
    recovery('Sun', 'Rest & reset'),
  ],
};

export function getWeekPlan(level = 'medium', place = 'gym') {
  const plans = place === 'home' ? homePlans : gymPlans;
  return (plans[level] || plans.medium).map((day) => ({ ...day, exerciseIds: [...day.exerciseIds] }));
}

export function dateKey(date = new Date()) {
  const local = date instanceof Date ? date : new Date(date);
  const month = String(local.getMonth() + 1).padStart(2, '0');
  const day = String(local.getDate()).padStart(2, '0');
  return `${local.getFullYear()}-${month}-${day}`;
}

export function getWeekDates(offset = 0) {
  const monday = new Date();
  monday.setHours(12, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + offset * 7);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return date;
  });
}
