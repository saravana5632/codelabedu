
class Main {
    public static void main(String[] args) {
        try {
            java.util.Scanner sc = new java.util.Scanner(System.in);
            java.util.List<String> lines = new java.util.ArrayList<>();
            while (sc.hasNextLine()) {
                String line = sc.nextLine().trim();
                if (!line.isEmpty()) lines.add(line);
            }
            if (lines.isEmpty()) return;
            Solution sol = new Solution();
            java.lang.reflect.Method[] methods = Solution.class.getDeclaredMethods();
            if (methods.length > 0) {
                java.lang.reflect.Method m = methods[0];
                Class<?>[] paramTypes = m.getParameterTypes();
                java.lang.reflect.Type[] genTypes = m.getGenericParameterTypes();
                Object[] invokeArgs = new Object[paramTypes.length];
                for (int i = 0; i < paramTypes.length && i < lines.size(); i++) {
                    invokeArgs[i] = parseValue(lines.get(i), paramTypes[i], genTypes[i]);
                }
                Object res = m.invoke(sol, invokeArgs);
                printResult(res);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
    
    private static Object parseValue(String val, Class<?> pt, java.lang.reflect.Type gt) {
        if (pt == int.class || pt == Integer.class) return Integer.parseInt(val);
        if (pt == long.class || pt == Long.class) return Long.parseLong(val);
        if (pt == double.class || pt == Double.class) return Double.parseDouble(val);
        if (pt == float.class || pt == Float.class) return Float.parseFloat(val);
        if (pt == boolean.class || pt == Boolean.class) return Boolean.parseBoolean(val);
        if (pt == char.class || pt == Character.class) {
            return val.replace("\"", "").replace("'", "").charAt(0);
        }
        if (pt == String.class) {
            if (val.length() >= 2 && val.startsWith("\"") && val.endsWith("\"")) {
                return val.substring(1, val.length() - 1);
            }
            return val;
        }
        if (pt.isArray()) {
            Class<?> comp = pt.getComponentType();
            if (comp.isArray()) { 
                String s = val.trim();
                if (s.length() >= 2 && s.startsWith("[") && s.endsWith("]")) {
                    s = s.substring(1, s.length() - 1);
                }
                if (s.isEmpty()) return java.lang.reflect.Array.newInstance(comp, 0);
                java.util.List<String> rows = new java.util.ArrayList<>();
                int depth = 0;
                StringBuilder sb = new StringBuilder();
                for (char c : s.toCharArray()) {
                    if (c == '[') depth++;
                    else if (c == ']') depth--;
                    sb.append(c);
                    if (depth == 0 && c == ']') {
                        rows.add(sb.toString());
                        sb.setLength(0);
                    }
                }
                Object arr = java.lang.reflect.Array.newInstance(comp, rows.size());
                for (int i = 0; i < rows.size(); i++) {
                    java.lang.reflect.Array.set(arr, i, parseValue(rows.get(i), comp, comp));
                }
                return arr;
            } else {
                String s = val.trim();
                if (s.length() >= 2 && s.startsWith("[") && s.endsWith("]")) {
                    s = s.substring(1, s.length() - 1);
                }
                if (s.isEmpty()) return java.lang.reflect.Array.newInstance(comp, 0);
                java.util.List<String> parts = new java.util.ArrayList<>();
                boolean inQuote = false;
                StringBuilder sb = new StringBuilder();
                for (char c : s.toCharArray()) {
                    if (c == '"') inQuote = !inQuote;
                    if (c == ',' && !inQuote) {
                        parts.add(sb.toString());
                        sb.setLength(0);
                    } else {
                        sb.append(c);
                    }
                }
                parts.add(sb.toString());
                
                Object arr = java.lang.reflect.Array.newInstance(comp, parts.size());
                for (int i = 0; i < parts.size(); i++) {
                    java.lang.reflect.Array.set(arr, i, parseValue(parts.get(i).trim(), comp, comp));
                }
                return arr;
            }
        }
        if (pt == java.util.List.class) {
            Class<?> comp = String.class;
            if (gt instanceof java.lang.reflect.ParameterizedType) {
                java.lang.reflect.Type tArg = ((java.lang.reflect.ParameterizedType)gt).getActualTypeArguments()[0];
                if (tArg == Integer.class) comp = Integer.class;
                else if (tArg == String.class) comp = String.class;
            }
            String s = val.trim();
            if (s.length() >= 2 && s.startsWith("[") && s.endsWith("]")) {
                s = s.substring(1, s.length() - 1);
            }
            java.util.List<Object> list = new java.util.ArrayList<>();
            if (s.isEmpty()) return list;
            
            java.util.List<String> parts = new java.util.ArrayList<>();
            boolean inQuote = false;
            StringBuilder sb = new StringBuilder();
            for (char c : s.toCharArray()) {
                if (c == '"') inQuote = !inQuote;
                if (c == ',' && !inQuote) {
                    parts.add(sb.toString());
                    sb.setLength(0);
                } else {
                    sb.append(c);
                }
            }
            parts.add(sb.toString());
            
            for (String part : parts) {
                list.add(parseValue(part.trim(), comp, comp));
            }
            return list;
        }
        return val;
    }
    
    private static void printResult(Object res) {
        if (res == null) {
            System.out.println("null");
        } else if (res.getClass().isArray()) {
            if (res.getClass().getComponentType().isArray()) {
                System.out.println(java.util.Arrays.deepToString((Object[]) res).replace(" ", ""));
            } else {
                Class<?> comp = res.getClass().getComponentType();
                if (comp == int.class) System.out.println(java.util.Arrays.toString((int[])res).replace(" ", ""));
                else if (comp == long.class) System.out.println(java.util.Arrays.toString((long[])res).replace(" ", ""));
                else if (comp == double.class) System.out.println(java.util.Arrays.toString((double[])res).replace(" ", ""));
                else if (comp == float.class) System.out.println(java.util.Arrays.toString((float[])res).replace(" ", ""));
                else if (comp == boolean.class) System.out.println(java.util.Arrays.toString((boolean[])res).replace(" ", ""));
                else if (comp == char.class) System.out.println(java.util.Arrays.toString((char[])res).replace(" ", ""));
                else {
                    Object[] arr = (Object[]) res;
                    System.out.print("[");
                    for (int i = 0; i < arr.length; i++) {
                        if (arr[i] instanceof String) System.out.print("\"" + arr[i] + "\"");
                        else System.out.print(arr[i]);
                        if (i < arr.length - 1) System.out.print(",");
                    }
                    System.out.println("]");
                }
            }
        } else if (res instanceof java.util.List) {
            java.util.List<?> list = (java.util.List<?>) res;
            System.out.print("[");
            for (int i = 0; i < list.size(); i++) {
                Object item = list.get(i);
                if (item instanceof String) System.out.print("\"" + item + "\"");
                else System.out.print(item);
                if (i < list.size() - 1) System.out.print(",");
            }
            System.out.println("]");
        } else {
            System.out.println(res);
        }
    }
}

